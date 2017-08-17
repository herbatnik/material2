/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, OnInit, ElementRef} from '@angular/core';


/**
 * Fixed header that will be rendered above a select's options.
 */
@Directive({
  selector: 'md-select-header, mat-select-header',
  host: {
    'class': 'mat-select-header'
  }
})
export class MdSelectHeader {
  private _inputElement;
  constructor(private element: ElementRef) { }

  ngOnInit(){
    this._inputElement = this.element.nativeElement.querySelector('input');
  }

  get hasFocus():boolean{
    return document.activeElement == this._inputElement;
  }

  focus(): void {
    this._inputElement.focus();
  }
 }
