module dv {
    'use strict';

    //#region Scrollbar
    let TOUCH_TYPES = (function() {
        let TOUCH_START: string;
        let TOUCH_MOVE: string;
        let TOUCH_END: string;
        
        if (typeof window !== 'undefined' && ('ontouchstart' in window || ((<any>window).DocumentTouch && document instanceof (<any>window).DocumentTouch))) {
            TOUCH_START = 'touchstart';
            TOUCH_MOVE = 'touchmove';
            TOUCH_END = 'touchend';
        } else if (typeof navigator !== 'undefined' && navigator.msMaxTouchPoints) { //support ie touch
            if ((<any>window).MSPointerEvent) {
                TOUCH_START = 'MSPointerDown';
                TOUCH_MOVE = 'MSPointerMove';
                TOUCH_END = 'MSPointerMove';
            } else if ((<any>window).PointerEvent) {
                TOUCH_START = 'pointerdown';
                TOUCH_MOVE = 'pointermove';
                TOUCH_END = 'pointerup';
            }
        }

        return {TOUCH_START: TOUCH_START, TOUCH_MOVE: TOUCH_MOVE, TOUCH_END: TOUCH_END};
    })();
    let SCROLLBAR_EVENTS = {
        SCROLLED: 'Scrolled'
    };

    /**
     * @hidden
     * Represents the scrollbar orientation.
     */
    export enum ScrollOrientation {
        /**
         * Horizontal scroll.
         */
        HorizontalScroll = 0,
        
        /**
         * Vertical scroll.
         */
        VerticalScroll = 1
    }

    /**
     * @hidden
     * Represents the scrollbar.
     */
    export class Scrollbar {
        private __host: HTMLElement;
        private __options: any;
        private __xscroll: boolean;
        private	__yscroll: boolean;
        private __event: Event;
        private __touchIntervalId: any;
        private __observer: any;

        private __containerLeft: number;
        private __containerTop: number;
        private __containerWidth: number;
        private __containerHeight: number;
        private __contentWidth: number;
        private __contentHeight: number;

        private __scrollLeft: number;
        private __scrollTop: number;
        private __isScrollXActive: boolean;
        private __isScrollYActive: boolean;
        private __thumbXLeft: number;
        private __thumbXWidth: number;
        private __thumbYTop: number;
        private __thumbYHeight: number;
        private __trackYMarginHeight: number;
        private __trackYHeight: number;
        private __trackXMarginWidth: number;
        private __trackXWidth: number;
        private __scrollbar: HTMLElement;
        private __trackX: HTMLElement;
        private __thumbX: HTMLElement;
        private __trackY: HTMLElement;
        private __thumbY: HTMLElement;
            
        constructor(host: HTMLElement, options: any) {
            options = options || {};

            this.__host = host;
            this.__options = options;

            this.__xscroll = (options.xscroll === false ? false: true);
            this.__yscroll = (options.yscroll === false ? false: true);
            this.__event = new Event();
            this.__touchIntervalId = null;
            this.__observer = null;

            this.__containerLeft = 0;
            this.__containerTop = 0;
            this.__containerWidth = 0;
            this.__containerHeight = 0;
            this.__contentWidth = 0;
            this.__contentHeight = 0;

            this.__scrollLeft = 0;
            this.__scrollTop = 0;
            this.__isScrollXActive = false;
            this.__isScrollYActive = false;
            this.__thumbXLeft = 0;
            this.__thumbXWidth = 0;
            this.__thumbYTop = 0;
            this.__thumbYHeight = 0;
            this.__trackYMarginHeight = 0;
            this.__trackYHeight = 0;
            this.__trackXMarginWidth = 0;
            this.__trackXWidth = 0;

            //create dv-scrollbar
            this.__scrollbar = this._createElement('div', 'gcdv-scrollbar', {
                width: 0,
                height: 0,
                position: 'relative'
            });

            this.__trackX = this._createElement('div', 'gcdv-scrollbar-trackX', {
                position: 'absolute'
            });
            this.__thumbX = this._createElement('div', 'gcdv-scrollbar-thumbX');
            this.__trackX.appendChild(this.__thumbX);

            this.__trackY = this._createElement('div', 'gcdv-scrollbar-trackY', {
                position: 'absolute'
            });
            this.__thumbY = this._createElement('div', 'gcdv-scrollbar-thumbY');
            this.__trackY.appendChild(this.__thumbY);

            this.__scrollbar.appendChild(this.__trackX);
            this.__scrollbar.appendChild(this.__trackY);
            this.__host.insertBefore(this.__scrollbar, this.__host.firstChild);

            this.update();
            this._bindEvents();
        }

        scrollLeft(): number {
            return this.__scrollLeft;
        }

        scrollTop(): number {
            return this.__scrollTop;
        }

        dispose() {
            if (this.__observer) {
                this.__observer.disconnect();
            }
            this.__event.off();
            this.__host.removeChild(this.__scrollbar);
        }

        update():void {
            let host = this.__host;

            let containerRect;
			let contentSize;
			let scrollRange = this.__options.scrollRange;
			if (scrollRange) {
				containerRect = scrollRange.containerRect;
				contentSize = scrollRange.contentSize;
			}

            if (containerRect) {
                this.__containerLeft = containerRect.left;
                this.__containerTop = containerRect.top;
                this.__containerWidth = containerRect.width;
                this.__containerHeight = containerRect.height;
            } else {
                this.__containerLeft = 0;
                this.__containerTop = 0;
                this.__containerWidth = host.clientWidth;
                this.__containerHeight = host.clientHeight;
            }
            if (contentSize) {
                this.__contentWidth = contentSize.width;
                this.__contentHeight = contentSize.height;
            } else {
                this.__contentWidth = host.scrollWidth;
                this.__contentHeight = host.scrollHeight;
            }

            let trackXStyle = this._getStyle(this.__trackX);
            this.__trackXMarginWidth = this._toInt(trackXStyle.marginLeft) + this._toInt(trackXStyle.marginRight);
            this.__trackXWidth = this.__containerWidth - this.__trackXMarginWidth;

            let trackYStyle = this._getStyle(this.__trackY);
            this.__trackYMarginHeight = this._toInt(trackYStyle.marginTop) + this._toInt(trackYStyle.marginBottom);
            this.__trackYHeight = this.__containerHeight - this.__trackYMarginHeight;

            //scrollX
            if (this.__xscroll && this.__contentWidth > this.__containerWidth) {
                this.__isScrollXActive = true;
                this.__trackXWidth =this.__containerWidth - this.__trackXMarginWidth;
                this.__thumbXWidth = this._getThumbXSize();

                this.__scrollbar.classList.add('gcdv-active-x');
            } else {
                this.__isScrollXActive = false;
                this.__trackXWidth = 0;
                this.__thumbXWidth = 0;

                this.__scrollbar.classList.remove('gcdv-active-x');
            }
            //scrollY
            if (this.__yscroll && this.__contentHeight > this.__containerHeight) {
                this.__isScrollYActive = true;
                this.__trackYHeight = this.__containerHeight - this.__trackYMarginHeight;
                this.__thumbYHeight = this._getThumbYSize();

                this.__scrollbar.classList.add('gcdv-active-y');
            } else {
                this.__isScrollYActive = false;
                this.__trackYHeight = 0;
                this.__thumbYHeight = 0;

                this.__scrollbar.classList.remove('gcdv-active-y');
            }

            this._updatePosition();
        }

        _updatePosition():void {
            let host = this.__host;

            if(this.__isScrollXActive) {
                this.__thumbXLeft = this.__scrollLeft * (this.__trackXWidth - this.__thumbXWidth) / (this.__contentWidth - this.__containerWidth);
            } else {
                this.__thumbXLeft = 0;
            }

            if (this.__isScrollYActive) {
                this.__thumbYTop = this.__scrollTop * (this.__trackYHeight - this.__thumbYHeight) / (this.__contentHeight - this.__containerHeight);
            } else {
                this.__thumbYTop = 0;
            }

            this.__thumbXLeft = Math.min( this.__thumbXLeft, this.__trackXWidth - this.__thumbXWidth);
            this.__thumbYTop = Math.min(this.__thumbYTop,this.__trackYHeight - this.__thumbYHeight);

            //update css
            this._setCss(this.__scrollbar, {
                left: host.scrollLeft + this.__containerLeft,
                top: host.scrollTop + this.__containerTop
            });
            this._setCss(this.__trackX, {
                left: 0,
                top: this.__containerHeight - this.__trackX.offsetHeight,
                width: this.__trackXWidth
            });
            this._setCss(this.__thumbX, {
                left: this.__thumbXLeft,
                width: this.__thumbXWidth
            });
            this._setCss(this.__trackY, {
                left: this.__containerWidth - this.__trackY.offsetWidth,
                top: 0,
                height: this.__trackYHeight
            });
            this._setCss(this.__thumbY, {
                top: this.__thumbYTop,
                height: this.__thumbYHeight
            });
        }

        //
        on(type:string, fn: any) {
            this.__event.object(this).on(type, fn);
        }

        once(type: string, fn: any) { 
            this.__event.object(this).once(type, fn);
        }

        off(type: string) {
            this.__event.object(this).off(type);
        }

        _fire(type:string, data: any) {
            this.__event.object(this).fire(type, data);
        }

        //
        _bindEvents() {
            let event = this.__event;

            //size
            event.element(window).on('resize', (e: UIEvent) => this._onWindowResize(e));

            //document keydown
            event.element(this.__host.ownerDocument).on('keydown', (e: KeyboardEvent) => this._onDocumentKeyDown(e));

            //host content change
            var MutationObserver = (<any>window).MutationObserver || (<any>window).WebKitMutationObserver || (<any>window).MozMutationObserver;
            if (MutationObserver) {
                this.__observer = new MutationObserver( (mutations: any) => this._onHostChildrenChange(mutations));
                this.__observer.observe(this.__host, { subtree: true, childList: true });
            }

            //host
            let hostEvent = event.element(this.__host);
            hostEvent.on('scroll', (e: UIEvent) => this._onHostScroll(e));
            hostEvent.on('wheel', (e: WheelEvent) => this._onHostMouseWheel(e));
            hostEvent.on(TOUCH_TYPES.TOUCH_START, (e: TouchEvent) => this._onHostTouchStart(e));
            hostEvent.on('mouseenter', (e: MouseEvent) => this._onHostMouseEnter(e));
            hostEvent.on('mouseleave', (e:MouseEvent) => this._onHostMouseLeave(e));
            hostEvent.on('mousemove', (e:MouseEvent) => this._onHostMouseMove(e));

            //mouse
            event.element(this.__trackX).on('mousedown', (e: MouseEvent) => this._onTrackXMouseDown(e));
            event.element(this.__thumbX).on('mousedown', (e: MouseEvent) => this._onThumbXMouseDown(e));
            event.element(this.__trackY).on('mousedown', (e: MouseEvent) => this._onTrackYMouseDown(e));
            event.element(this.__thumbY).on('mousedown', (e: MouseEvent) => this._onThumbYMouseDown(e));
        }

        _onHostChildrenChange(mutations: any) {
            this.update();
        }

        _onWindowResize(evt: UIEvent) {
            this.update();
        }
        
        _onDocumentKeyDown(evt: KeyboardEvent) {
            if (((<any>evt).isDefaultPrevented && (<any>evt).isDefaultPrevented()) || evt.defaultPrevented) {
                return;
            }
    
            const eMatches = Element && (
                   Element.prototype.matches 
                || Element.prototype.webkitMatchesSelector 
                || Element.prototype.msMatchesSelector);
        
            let scrollbarFocused = eMatches.call(this.__thumbX, ':focus') || eMatches.call(this.__thumbY, ':focus');
            let hostHovered = this.__scrollbar.classList.contains('gcdv-hover');
            if(!hostHovered && !scrollbarFocused) { 
                return;
            }
            
            let activeElement = document.activeElement || this.__host.ownerDocument.activeElement;
            if (activeElement) {
                if(activeElement.tagName === 'IFRAME') {
                    activeElement = (<HTMLFrameElement>activeElement).contentDocument.activeElement;
                }
    
                if (eMatches.call(activeElement, 'input,[contenteditable]') 
                 || eMatches.call(activeElement, 'select,[contenteditable]') 
                 || eMatches.call(activeElement, 'textarea,[contenteditable]') 
                 || eMatches.call(activeElement, 'button,[contenteditable]')) {
                    return;
                }
            }
    
            let deltaX = 0;
            let deltaY = 0;
    
            switch (evt.which) {
                case 37: //left:
                    deltaX = -40;
                    break;
                case 39: //right
                    deltaX = 40;
                    break;
                case 38: //up
                    deltaY = 40;
                    break;
                case 40: //down
                    deltaY = -40;
                    break;
                case 33: // page up
                    deltaY = this.__containerHeight;
                    break;
                case 34: // page down
                    deltaY = -this.__containerHeight;
                    break;
                case 36: // home
                    deltaY = this.__contentHeight;
                    break;
                case 35: // end
                    deltaY = -this.__contentHeight;
                    break;
                default:
                    return;
            }
    
            let newScrollTop = this.__scrollTop - deltaY;
            let newScrollLeft = this.__scrollLeft + deltaX;
    
            let shouldPreventDefault = false;
            if (this.__isScrollYActive) {
                this._processYScrolled(newScrollTop);
                shouldPreventDefault = true;
            } else if (this.__isScrollXActive) {
                this._processXScrolled(newScrollLeft);
                shouldPreventDefault = true;
            }
            if (shouldPreventDefault) {
                evt.preventDefault();
                evt.stopPropagation();
            }
    
            this._updatePosition();
        }

        _onHostScroll(evt: UIEvent) {
            let host = this.__host;
            if (!this._isRangeScroll()) {
                this.__scrollTop = host.scrollTop;
                this.__scrollLeft = host.scrollLeft;
            }

            this._updatePosition();
        }

        _onHostMouseEnter(evt: MouseEvent) {
            if(!this._isRangeScroll()) {
                this.__scrollbar.classList.add('gcdv-hover');
                this._updatePosition();
            }
        }

        _onHostMouseLeave(evt: MouseEvent) {
            this.__scrollbar.classList.remove('gcdv-hover');
            this._updatePosition();
        }

        _onHostMouseMove(evt: MouseEvent) {
            if(this._isRangeScroll()) {
                if(this._mouseInContainer(evt)) {
                    this.__scrollbar.classList.add('gcdv-hover');
                } else {
                    this.__scrollbar.classList.remove('gcdv-hover');
                }

                this._updatePosition();
            }
        }

        _onHostMouseWheel(evt: WheelEvent) {
            if (!this._mouseInContainer(evt)) {
                return;
            }

            let [deltaX, deltaY] = this._getWheelDelte(evt);

            let newScrollTop = this.__scrollTop - deltaY;
            let newScrollLeft = this.__scrollLeft + deltaX;

            let shouldPreventDefault = false;

            if (this.__isScrollYActive && deltaY !== 0) {
                this._processYScrolled(newScrollTop);
                shouldPreventDefault = true;
            } else if (this.__isScrollXActive && deltaX !== 0) {
                this._processXScrolled(newScrollLeft);
                shouldPreventDefault = true;
            }

            this._updatePosition();

            if (shouldPreventDefault) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        _getWheelDelte(orgEvent: WheelEvent) {
            let deltaX = 0;
            let deltaY = 0;

            // Old school scrollwheel delta
            if ('detail' in orgEvent) {
                deltaY = orgEvent.detail * -1;
            }
            if ('wheelDelta' in orgEvent) {
                deltaY = orgEvent.wheelDelta;
            }
            if ('wheelDeltaY' in orgEvent) {
                deltaY = orgEvent.wheelDeltaY;
            }
            if ('wheelDeltaX' in orgEvent) {
                deltaX = orgEvent.wheelDeltaX * -1;
            }

            // New school wheel delta (wheel event)
            if ('deltaY' in orgEvent) {
                deltaY = orgEvent.deltaY * -1;
            }
            if ('deltaX' in orgEvent) {
                deltaX = orgEvent.deltaX;
            }

            // Need to convert lines and pages to pixels if we aren't already in pixels
            // There are three delta modes:
            //   * deltaMode 0 is by pixels, nothing to do
            //   * deltaMode 1 is by lines
            //   * deltaMode 2 is by pages
            if (orgEvent.deltaMode === 1) {
                deltaX *= 10;
                deltaY *= 10;
            } else if (orgEvent.deltaMode === 2) {
                //
            }

            return [deltaX, deltaY];
        }

        _mouseInContainer(evt: MouseEvent) {
            if (this._isRangeScroll()) {
                let hostRect = this.__host.getBoundingClientRect();

            let evtX = evt.pageX - hostRect.left;
            let evtY = evt.pageY - hostRect.top;
            if ((this.__containerLeft <= evtX && evtX < this.__containerLeft + this.__containerWidth) && 
                (this.__containerTop <= evtY && evtY < this.__containerTop + this.__containerHeight)) {
                return true;
            }
            return false;
            }
            return true;
        }

        _onHostTouchStart(evt: TouchEvent) {
            if (!this._shouldHandleTouch(evt)) {
                return;
            }

            let self = this;
            let startOffset: any = {};
            let startTime: number = 0;
            let speed: any = {};
            
            let touch: any = evt.targetTouches ? evt.targetTouches[0]: evt;

            startOffset.pageX = touch.pageX;
            startOffset.pageY = touch.pageY;
        
            startTime = new Date().getTime();
        
            if (self.__touchIntervalId) {
                clearInterval(self.__touchIntervalId);
            }

            //
            let hostEvent = self.__event.element(self.__host);
            //
            hostEvent.off(TOUCH_TYPES.TOUCH_MOVE);
            hostEvent.on(TOUCH_TYPES.TOUCH_MOVE, touchMoveHandler);
            function touchMoveHandler(e:TouchEvent) {
                if (!self._shouldHandleTouch(e)) { 
                    return;
                }
                let touch: any = e.targetTouches ? e.targetTouches[0]: e;

                let currentOffset = { pageX: touch.pageX, pageY: touch.pageY };
            
                let differenceX = currentOffset.pageX - startOffset.pageX;
                let differenceY = currentOffset.pageY - startOffset.pageY;
                
                let newScrollTop = self.__scrollTop - differenceY;
                let newScrollLeft = self.__scrollLeft - differenceX;
                self._processYScrolled(newScrollTop);
                self._processXScrolled(newScrollLeft);
                self._updatePosition();
            
                startOffset = currentOffset;
            
                let currentTime = new Date().getTime();
                let timeGap = currentTime - startTime;
                if (timeGap > 0) {
                    speed.x = differenceX / timeGap;
                    speed.y = differenceY / timeGap;
                    startTime = currentTime;
                }
                
                e.preventDefault();
                e.stopPropagation();
            }
            //
            hostEvent.off(TOUCH_TYPES.TOUCH_END);
            hostEvent.on(TOUCH_TYPES.TOUCH_END, touchEndHandler);
            function touchEndHandler(e: TouchEvent) {
                hostEvent.off(TOUCH_TYPES.TOUCH_MOVE);
                hostEvent.off(TOUCH_TYPES.TOUCH_END);

                clearInterval(self.__touchIntervalId);
                self.__touchIntervalId = setInterval(function() {
                    if (!speed.x && !speed.y) {
                        clearInterval(self.__touchIntervalId);
                        return;
                    }

                    if (Math.abs(speed.x) < 0.01 && Math.abs(speed.y) < 0.01) {
                        clearInterval(self.__touchIntervalId);
                        return;
                    }

                    let newScrollTop = self.__scrollTop - speed.y * 30;
                    let newScrollLeft = self.__scrollLeft - speed.x * 30;
                    self._processYScrolled(newScrollTop);
                    self._processXScrolled(newScrollLeft);
                    self._updatePosition();

                    speed.x *= 0.8;
                    speed.y *= 0.8;
                }, 10);
            }
        }

        _shouldHandleTouch(evt: any) {
            if (evt.pointerType && evt.pointerType === 'pen' && evt.buttons === 0) {
            return false;
            }
            if (evt.targetTouches && evt.targetTouches.length === 1) {
            return true;
            }
            if (evt.pointerType && evt.pointerType !== 'mouse' && evt.pointerType !== evt.MSPOINTER_TYPE_MOUSE) {
            return true;
            }
            return false;
        }

        _onTrackXMouseDown(evt: MouseEvent) {
            let thumbXRect = this.__thumbX.getBoundingClientRect();
            let evtX = evt.pageX - window.pageXOffset;

            let direction = evtX < thumbXRect.left ? -1 : 1;
            let newScrollLeft = this.__scrollLeft + direction * this.__containerWidth;

            this._processXScrolled(newScrollLeft);
            this._updatePosition();

            evt.preventDefault();
            evt.stopPropagation();
        }

        _onThumbXMouseDown(evt: MouseEvent) {
            let self = this;
            let startScrollLeft = self.__scrollLeft;
            let startPageX = evt.pageX;
            let scrollBy = (self.__contentWidth - self.__containerWidth) / (self.__trackXWidth - self.__thumbXWidth);

            //
            let doc: any = self.__host.ownerDocument;
            let docEvent = self.__event.element(doc);
            docEvent.on("mousemove", mouseMoveHandler);
            function mouseMoveHandler(e: MouseEvent) {
                let newScrollLeft = startScrollLeft + scrollBy * (e.pageX - startPageX);
                self._processXScrolled(newScrollLeft);
                self.__scrollbar.classList.add('gcdv-scrolling-x');
                self._updatePosition();

                e.preventDefault();
                e.stopPropagation();
            }
            docEvent.on("mouseup", mouseUpHandler);
            function mouseUpHandler() {
                self.__event.off(doc);

                self.__scrollbar.classList.remove('gcdv-scrolling-x');
                self._updatePosition();
            }

            evt.preventDefault();
            evt.stopPropagation();
        }

        _onTrackYMouseDown(evt: MouseEvent) {
            let thumbYRect = this.__thumbY.getBoundingClientRect();
            let evtY = evt.pageY - window.pageYOffset;

            let direction = evtY < thumbYRect.top ? -1 : 1;
            let newScrollTop = this.__scrollTop + direction * this.__containerHeight;

            this._processYScrolled(newScrollTop);
            this._updatePosition();

            evt.preventDefault();
            evt.stopPropagation();
        }

        _onThumbYMouseDown(evt: MouseEvent) {
            let self = this;
            let startScrollTop = self.__scrollTop;
            let startPageY = evt.pageY;
            let scrollBy = (self.__contentHeight - self.__containerHeight) / (self.__trackYHeight - self.__thumbYHeight);

            //
            let doc:any = self.__host.ownerDocument;
            let docEvent = self.__event.element(doc);
            docEvent.on('mousemove', mouseMoveHandler);
            function mouseMoveHandler(e: MouseEvent) {
                let newScrollTop = startScrollTop + scrollBy * (e.pageY - startPageY);
                self._processYScrolled(newScrollTop);
                self.__scrollbar.classList.add('gcdv-scrolling-y');
                self._updatePosition();

                e.preventDefault();
                e.stopPropagation();
            }
            docEvent.on('mouseup', mouseUpHandler);
            function mouseUpHandler() {
                self.__event.off(doc);

                self.__scrollbar.classList.remove('gcdv-scrolling-y');
                self._updatePosition();
            }

            evt.preventDefault();
            evt.stopPropagation();
        }

        //
        _processXScrolled(newScrollLeft: number): void {
            newScrollLeft = Math.max(0, Math.min(newScrollLeft, this.__contentWidth - this.__containerWidth));

            let diff = this.__scrollLeft - newScrollLeft;
            if (diff) {
                let oldScrollLeft = this.__scrollLeft;
                this.__scrollLeft = newScrollLeft;
                if (!this._isRangeScroll()) {
                    this.__host.scrollLeft = newScrollLeft;
                }
                this._fire(SCROLLBAR_EVENTS.SCROLLED, {
                    scrollOrientation: ScrollOrientation.HorizontalScroll,
                    newValue: this.__scrollLeft,
                    oldValue: oldScrollLeft
                });
            }
        }

        _processYScrolled(newScrollTop:number): void {
            newScrollTop = Math.max(0, Math.min(newScrollTop, this.__contentHeight - this.__containerHeight));

            let diff = this.__scrollTop - newScrollTop;
            if (diff) {
                let oldScrollTop = this.__scrollTop;
                this.__scrollTop = newScrollTop;

                if (!this._isRangeScroll()) {
                    this.__host.scrollTop = newScrollTop;
                }

                this._fire(SCROLLBAR_EVENTS.SCROLLED, {
                    scrollOrientation: ScrollOrientation.VerticalScroll,
                    newValue: this.__scrollTop,
                    oldValue: oldScrollTop
                });
            }
        }

        //
        _getThumbXSize(): number {
            return this.__trackXWidth * this.__containerWidth / this.__contentWidth;
        }

        _getThumbYSize(): number {
            return (
                this.__trackYHeight * this.__containerHeight / this.__contentHeight
            );
        }

        //
        _createElement(tag: string, className: string, style?: any): HTMLElement {
            let element = document.createElement(tag);
            element.className = className;
            if (style) {
                this._setCss(element, style);
            };

            return element;
        }

        _getStyle(element: HTMLElement): CSSStyleDeclaration {
            return getComputedStyle(element);
        }

        _getCss(element: HTMLElement, propertyName:any):string {
            return this._getStyle(element)[propertyName];
        }

        _setCss(element: HTMLElement, properties: any): void {
            for (let key in properties) {
                let v = properties[key];
                if (typeof v === "number") {
                    v = v + 'px';
                }
                element.style[<any>key] = v;
            }
        }
        
        //
        _isRangeScroll() : boolean {
            return  !!(this.__options.scrollRange);
        }
        _toInt(v:string): number {
            return parseInt(v, 10) || 0;
        }
    }
    //#endregion


    //#region EventObject
     /**
     * @hidden
     * Represents an object's event.
     */
    class EventObject {
        private __context: any;
        private __events: any;

        constructor(context: any) {
            this.__context = context;
            this.__events = {};
        }

        context(): any {
            return this.__context;
        }

        on(type: string, fn: any) {
            this._bind(type, fn, false);
        }
        once(type: string, fn: any) {
            this._bind(type, fn, true);
        }
        off(type: any) {
            let events = this.__events;

            if (!type) {
                this.__events = {};
            } else if (typeof type === "string") {
                delete events[type];
            } else if (typeof type === "function") {
                for (let t in events) {
                    let fns = events[t] || [];
                    for (let i = 0; i < fns.length; i++) {
                        if (fns[i][0] === type) {
                            fns.splice(i--, 1);
                        }
                    }
                }
            }
        }
        fire(type: string, ...args: any[]) {
            let fns = this.__events[type];
            if (!fns || fns.length === 0) {
                return;
            }

            for (let i = 0; i < fns.length; i++) {
                let fn = fns[i];
                fn[0].apply(this.__context, args);
                if (fn[1]) {
                    //once
                    fns.splice(i--, i);
                }
            }
        }

        _bind(type: string, fn: any, once: boolean) {
            if (typeof type !== "string" || typeof fn !== "function") {
                return;
            }

            if (!this.__events[type]) {
                this.__events[type] = [];
            }
            this.__events[type].push([fn, once]);
        }
    }
    //#endregion

    //#region EventElement

    /**
     * @hidden
     * Represents html element's event.
     */
    class EventElement {
        private __element: HTMLElement | Window | Document;
        private __events: any;

        constructor(element:  HTMLElement | Window | Document) {
            this.__element = element;
            this.__events = {};
        }

        context(): HTMLElement | Window | Document {
            return this.__element;
        }

        on(type: string, fn: any) {
            if (typeof type !== 'string' || typeof fn !== 'function') {
                return;
            }

            if (!this.__events[type]) {
                this.__events[type] = [];
            }
            this.__events[type].push(fn);
            this.__element.addEventListener(type, fn, false);
        }
        off(type: any) {
            let events = this.__events;

            if (!type) {
                for (let t in events) {
                    let fns = events[t] || [];
                    for (let i = 0; i < fns.length; i++) {
                        this.__element.removeEventListener(t, fns[i], false);
                    }
                }
                this.__events = {};
            } else if (typeof type === 'string') {
                let fns = events[type] || [];
                for (let i = 0; i < fns.length; i++) {
                    this.__element.removeEventListener(type, fns[i], false);
                }
                delete events[type];
            } else if (typeof type === 'function') {
                for (let t in events) {
                    let fns = events[t] || [];
                    for (let i = 0; i < fns.length; i++) {
                        if (fns[i] === type) {
                            this.__element.removeEventListener(t, fns[i], false);
                            fns.splice(i--, 1);
                        }
                    }
                }
            }
        }
    }

    //#endregion

    //#region  Event
    /**
     * @hidden
     * Represents a customer event.
     */
    class Event {
        private __events: any[];
        constructor() {
            this.__events = [];
        }

        element(element: HTMLElement | Window | Document): EventElement {
            let event = this.__events.filter(item => item.context() === element)[0];
            if (!event) {
                event = new EventElement(element);
                this.__events.push(event);
            }
            return event;
        }
        object(obj: any): EventObject {
            let event = this.__events.filter(item => item.context() === obj)[0];
            if (!event) {
                event = new EventObject(obj);
                this.__events.push(event);
            }
            return event;
        }

        off(context?: any) {
            let events = this.__events;

            if (context) {
                for (let i = 0; i < events.length; i++) {
                    if (events[i].context() === context) {
                        events[i].off();
                        events.splice(i--, 1);
                    }
                }
            } else {
                for (let i = 0; i < events.length; i++) {
                    events[i].off();
                }
                this.__events = [];
            }
        }
    }
    //#endregion
}