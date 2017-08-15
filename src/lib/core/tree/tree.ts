import {
  AfterContentInit,
  ViewChild,
  Component,
  Directive,
  TemplateRef,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ContentChildren,
  ContentChild,
  QueryList,
  ViewContainerRef,
  Input,
  forwardRef,
  IterableDiffers,
  IterableDiffer,
  Inject,
  ViewEncapsulation,
  ElementRef,
  Renderer2,
  OnInit,
  OnDestroy,
  IterableChangeRecord
} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/let';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/observable/combineLatest';
import {TreeDataSource} from './data-source';
import {TreeControl} from './tree-control';
import {SelectionModel, UP_ARROW, DOWN_ARROW, RIGHT_ARROW, LEFT_ARROW, HOME, ENTER, ESCAPE, FocusOriginMonitor} from '../core';
import {FocusKeyManager, Focusable} from '../a11y/focus-key-manager';
import {coerceBooleanProperty} from '../coercion/boolean-property';
import {CollectionViewer} from './data-source';

/** Height of each row in pixels (48 + 1px border) */
export const ROW_HEIGHT = 49;

/** Amount of rows to buffer around the view */
export const BUFFER = 3;

/**
 * Node template
 */
@Directive({
  selector: '[cdkNodeDef]'
})
export class CdkNodeDef {
  constructor(public template: TemplateRef<any>,
              public tree: CdkTree) {}
}

// TODO: Role should be group for expandable ndoes
@Component({
  selector: 'cdk-node',
  template: '<ng-content></ng-content>'
})
export class CdkNode  implements Focusable, OnDestroy {
  @Input('cdkNode') data: any;
  constructor(private elementRef: ElementRef,
              private renderer: Renderer2,
              public tree: CdkTree,
              private _focusOriginMonitor: FocusOriginMonitor) {
    this.renderer.addClass(elementRef.nativeElement, 'mat-data');
    this._focusOriginMonitor.monitor(this.elementRef.nativeElement, this.renderer, true);
  }

  @Input()
  get role() {
    return 'treeitem';
  }

  ngOnDestroy() {
    this._focusOriginMonitor.stopMonitoring(this.elementRef.nativeElement);
  }

  /** Focuses the menu item. */
  focus(): void {
    this._getHostElement().focus();
  }

  /** Returns the host DOM element. */
  _getHostElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }
}

/**
 * Placeholder for md-nodes
 */
@Directive({
  selector: '[cdkNodePlaceholder]'
})
export class CdkNodePlaceholder {
  constructor(public viewContainer: ViewContainerRef) { }
}

/**
 * Indent for the children
 */
@Directive({
  selector: '[cdkNodePadding]',
  host: {
    '[style.padding-left]': 'paddingIndent',
  },
})
export class CdkNodePadding {
  @Input('cdkNodePadding') level: number;

  @Input('cdkNodePaddingIndex') indent: number = 28;

  get paddingIndent() {
    return `${this.level * this.indent}px`;
  }

  constructor(public node: CdkNode) {}
}


/**
 * Node trigger
 */
@Directive({
  selector: '[cdkNodeTrigger]',
  host: {
    'class': 'mat-node-trigger',
    '(click)': 'trigger($event)',
  }
})
export class CdkNodeTrigger {
  @Input('cdkNodeTrigger') node: any;
  @Input('cdkNodeTriggerRecursive') recursive: boolean = false;
  @Input('cdkNodeTriggerSelection') selection: SelectionModel<any>;

  constructor(@Inject(forwardRef(() => CdkTree)) private tree: CdkTree) {}

  trigger(event: Event) {
    this.selection.toggle(this.node);
    if (this.recursive) {
      this.selectRecursive(this.node, this.selection.isSelected(this.node));
    }
  }

  selectRecursive(node: any, select: boolean) {
    let children = this.tree.dataSource.getChildren(node);
    if (!!children) {
      children.forEach((child: any) => {
        select ? this.selection.select(child) : this.selection.deselect(child);
        this.selectRecursive(child, select);
      });
    }
  }
}

/**
 * Select trigger
 */
@Directive({
  selector: '[mdNodeSelectTrigger]',
  host: {
    'class': 'mat-node-select-trigger',
    '(change)': 'trigger($event)',
    '(click)': '$event.stopPropagation()',
  }
})
export class MdNodeSelectTrigger extends CdkNodeTrigger{
  @Input('mdNodeSelectTrigger') node: any;
}


/**
 * Nested node, add children to `mdNodePlaceholder` in template
 */
@Directive({
  selector: '[cdkNestedNode]'
})
export class CdkNestedNode implements OnInit {
  @Input('cdkNestedNode') node: any;

  @ContentChild(CdkNodePlaceholder) nodePlaceholder: CdkNodePlaceholder;

  constructor(@Inject(forwardRef(() => CdkTree)) private tree: CdkTree) {}

  ngOnInit() {
    let children = this.tree.dataSource.getChildren(this.node);
    if (!!children) {
      children.subscribe((childrenNodes) => {
        childrenNodes.forEach((child, index) => {
          this.tree.addNode(this.nodePlaceholder.viewContainer, child, index);
        });
      });
    }
  }
}

@Component({
  selector: 'cdk-tree',
  styleUrls: ['./tree.css'],
  template: `
    <ng-container cdkNodePlaceholder></ng-container>
    <ng-template #emptyNode><div class="mat-placeholder"></div></ng-template>
  `,
  host: {
    'role': 'tree',
    'class': 'mat-tree',
    '(keydown)': 'handleKeydown($event)',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CdkTree  implements CollectionViewer {
  @Input() dataSource: TreeDataSource<any>;
  @Input() treeControl: TreeControl<any>;

  /** Whether nested tree or flattened tree */
  @Input() nested: boolean = false;

  /** View changed for CollectionViewer */
  viewChanged = new BehaviorSubject({start: 0, end: 20});

  // Data differ
  private _dataDiffer: IterableDiffer<any> = null;

  // Focus related
  private _keyManager: FocusKeyManager;


  @ContentChildren(CdkNode) items: QueryList<CdkNode>;
  @ContentChildren(CdkNodeDef) nodeDefinitions: QueryList<CdkNodeDef>;
  @ViewChild(CdkNodePlaceholder) nodePlaceholder: CdkNodePlaceholder;
  @ViewChild('emptyNode') emptyNodeTemplate: TemplateRef<any>;

  constructor(private _differs: IterableDiffers, private elementRef: ElementRef,
              private changeDetectorRef: ChangeDetectorRef) {
    this._dataDiffer = this._differs.find([]).create();
  }

  ngOnInit() {
    Observable.fromEvent(this.elementRef.nativeElement, 'scroll')
      .debounceTime(100)
      .subscribe(() => this.scrollEvent());
  }

  ngAfterViewInit() {
    // Focus related
    this._keyManager = new FocusKeyManager(this.items).withWrap();

    this.dataSource.connect(this).subscribe((result: any[]) => {
      this.nested ? this.renderNestedNodeChanges(result) : this.renderNodeChanges(result);
    });
  }

  renderNestedNodeChanges(dataNodes: any[]) {

    console.time('Rendering rows');

    const oldScrollTop = this.elementRef.nativeElement.scrollTop;

    this.nodePlaceholder.viewContainer.clear();
    dataNodes.forEach((node, currentIndex) => {
      this.addNode(this.nodePlaceholder.viewContainer, node, currentIndex);
    });

    // Scroll changes in the process of adding/removing rows. Reset it back to where it was
    // so that it (1) it does not shift and (2) a scroll event does not get triggered which
    // would cause a loop.
    console.log(oldScrollTop);
    this.elementRef.nativeElement.scrollTop = 400;

    console.log(this.elementRef.nativeElement.scrollTop);
    this.changeDetectorRef.detectChanges();
    console.timeEnd('Rendering rows');
  }

  renderNodeChanges(dataNodes: any[]) {
    console.time('Rendering rows');
    const changes = this._dataDiffer.diff(dataNodes);
    if (!changes) { return; }

    const oldScrollTop = this.elementRef.nativeElement.scrollTop;
    changes.forEachOperation(
      (item: IterableChangeRecord<any>, adjustedPreviousIndex: number, currentIndex: number) => {
        if (item.previousIndex == null) {
          console.log('Adding row ');
          this.addNode(this.nodePlaceholder.viewContainer, dataNodes[currentIndex], currentIndex);
        } else if (currentIndex == null) {
          console.log('Removing a row ');
          this.nodePlaceholder.viewContainer.remove(adjustedPreviousIndex);
        } else {
          console.log('Moving a row');
          const view = this.nodePlaceholder.viewContainer.get(adjustedPreviousIndex);
          this.nodePlaceholder.viewContainer.move(view, currentIndex);
        }
      });

    // Scroll changes in the process of adding/removing rows. Reset it back to where it was
    // so that it (1) it does not shift and (2) a scroll event does not get triggered which
    // would cause a loop.
    console.log(oldScrollTop);
    this.elementRef.nativeElement.scrollTop = oldScrollTop;
    console.log(this.elementRef.nativeElement.scrollTop);
    this.changeDetectorRef.detectChanges();
    console.timeEnd('Rendering rows');
  }

  addNode(viewContainer: ViewContainerRef, data: any, currentIndex: number) {
    if (!!data) {
      this._addNodeInContainer(viewContainer, data, currentIndex);
    } else {
      viewContainer.createEmbeddedView(this.emptyNodeTemplate, {}, currentIndex);
    }
  }

  _addNodeInContainer(container: ViewContainerRef, data: any, currentIndex: number) {
    let node = this.getNodeDefForItem(data);
    this.dataSource.getChildren(data).subscribe((children) => {
      let expandable = !!children;
      const context: CdkTreeContext = {
        $implicit: data,
        level: this.treeControl.getLevel(data),
        expandable
      };
      container.createEmbeddedView(node.template, context, currentIndex);
    });

  }

  getNodeDefForItem(item: any) {
    // proof-of-concept: only supporting one row definition
    return this.nodeDefinitions.first;
  }


  /** Scroll related */
  scrollToTop() {
    this.elementRef.nativeElement.scrollTop = 0;
    console.log(`scroll top`);
  }

  scrollEvent() {
    console.log(`screoo event`);
    const scrollTop = this.elementRef.nativeElement.scrollTop;
    const elementHeight = this.elementRef.nativeElement.getBoundingClientRect().height;

    const topIndex = Math.floor(scrollTop / ROW_HEIGHT);

    const view = {
      start: Math.max(topIndex - BUFFER, 0),
      end: Math.ceil(topIndex + (elementHeight / ROW_HEIGHT)) + BUFFER
    };

    this.viewChanged.next(view);
  }

  scrollToIndex(topIndex: number) {
    const elementHeight = this.elementRef.nativeElement.getBoundingClientRect().height;
    const view = {
      start: Math.max(topIndex - BUFFER, 0),
      end: Math.ceil(topIndex + (elementHeight / ROW_HEIGHT)) + BUFFER
    };
    this.viewChanged.next(view);
    this.elementRef.nativeElement.scrollTop = topIndex * ROW_HEIGHT;
  }


  gotoParent(node: any) {
    let parent = this.treeControl.getParent(node);
    let index = this.treeControl.getIndex(parent);
    this.scrollToIndex(index);
  }
  /** Scroll related end */


  // Key related
  // TODO(tinagao): Work on keyboard traversal
  handleKeydown(event) {
    if (event.keyCode == UP_ARROW) {
      this._keyManager.setPreviousItemActive();
      // Move to previous index scrollToIndex(focusIndex - 1)
      console.log(`// Move to previous index scrollToIndex(focusIndex - 1)`);
    } else if (event.keyCode == DOWN_ARROW) {
      this._keyManager.setNextItemActive();
      console.log(`// Move to next index scrollToIndex(focusIndex + 1)`);
      // Move to next index scrollToIndex(focusIndex + 1)
    } else if (event.keyCode == RIGHT_ARROW) {
      console.log(`// If focus expandable, expand, scrollToIndex(focusIndex + 1)`);
      // If focus expandable, expand, scrollToIndex(focusIndex + 1)
    } else if (event.keyCode == LEFT_ARROW) {
      console.log(`// goToParent(focusIndex), collapse parent node`);
      // goToParent(focusIndex), collapse parent data
    }
  }


  /** Expand related end */
}
