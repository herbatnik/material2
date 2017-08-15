import {ApplicationRef, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpModule} from '@angular/http';
import {RouterModule} from '@angular/router';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ALL_ROUTES} from './demo-app/routes';
import {EntryApp} from './demo-app/demo-app';
import {DemoModule} from './demo-app/demo-module';
import {AccessibilityDemoModule} from './a11y/a11y-module';
import {SimpleTreeDemo} from './tree/simple-tree-demo';
import {SimpleTreeNode} from './tree/simple-tree-node';
import {NestedTreeDemo} from './tree/nested-tree-demo';
import {NestedTreeNode} from './tree/nested-tree-node';
  CdkTreeModule,
    CdkTreeModule,

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpModule,
    DemoModule,
    AccessibilityDemoModule,
    RouterModule.forRoot(ALL_ROUTES),
  ],
  declarations: [
    EntryApp,
    SimpleTreeDemo,
    NestedTreeDemo,
    SimpleTreeNode,
    NestedTreeNode,
  ],
  entryComponents: [
    EntryApp,
  ],
})
export class DemoAppModule {
  constructor(private _appRef: ApplicationRef) { }

  ngDoBootstrap() {
    this._appRef.bootstrap(EntryApp);
  }
}

