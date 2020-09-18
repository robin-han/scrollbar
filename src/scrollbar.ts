namespace dv {
    'use strict';

    /**
     * @hidden
     */
    const TOUCH_TYPES: { TOUCH_START: string, TOUCH_MOVE: string, TOUCH_END: string } = (() => {
        let TOUCH_START: string;
        let TOUCH_MOVE: string;
        let TOUCH_END: string;

        if (typeof window !== 'undefined' && (hasProperty(window, 'ontouchstart') || ((<any>window).DocumentTouch && document instanceof (<any>window).DocumentTouch))) {
            TOUCH_START = 'touchstart';
            TOUCH_MOVE = 'touchmove';
            TOUCH_END = 'touchend';
        } else if (typeof navigator !== 'undefined' && navigator.msMaxTouchPoints) { // support ie touch
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

        return { TOUCH_START: TOUCH_START, TOUCH_MOVE: TOUCH_MOVE, TOUCH_END: TOUCH_END };

        function hasProperty(obj: any, key: string, inherit: boolean = true): boolean {
            if (!inherit) {
                return obj.hasOwnProperty(key);
            }
            /* tslint:disable:cs-no-in */
            return (key in obj);
            /* tslint:enable:cs-no-in */
        }
    })();

    /**
     * @hidden
     */
    type ElementMatchesCallback = (selectors: string) => boolean;

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
        private static readonly __scrolled: string = 'Scrolled';

        private __host: HTMLElement;
        private __option: any;
        private __event: EventManager;
        private __touchIntervalId: any;
        private __observer: any;
        private __scrollXTimeoutId: any;
        private __scrollYTimeoutId: any;

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
        public __scrollbar: HTMLElement;
        private __trackX: HTMLElement;
        private __thumbX: HTMLElement;
        private __trackY: HTMLElement;
        private __thumbY: HTMLElement;

        constructor(host: HTMLElement, option: any) {
            option = option || {};

            this.__host = host;
            this.__option = option;

            this.__event = new EventManager();
            this.__touchIntervalId = null;
            this.__observer = null;
            this.__scrollXTimeoutId = null;
            this.__scrollYTimeoutId = null;

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

            // create dv-scrollbar
            this.__scrollbar = this._createElement('div', 'dv-scrollbar', {
                width: 0,
                height: 0,
                position: 'relative'
            });

            this.__trackX = this._createElement('div', 'dv-scrollbar-trackX', {
                position: 'absolute'
            });
            this.__thumbX = this._createElement('div', 'dv-scrollbar-thumbX');
            this.__trackX.appendChild(this.__thumbX);

            this.__trackY = this._createElement('div', 'dv-scrollbar-trackY', {
                position: 'absolute'
            });
            this.__thumbY = this._createElement('div', 'dv-scrollbar-thumbY');
            this.__trackY.appendChild(this.__thumbY);

            this.__scrollbar.appendChild(this.__trackX);
            this.__scrollbar.appendChild(this.__trackY);
            this.__host.insertBefore(this.__scrollbar, this.__host.firstChild);

            this.update();
            this._bindEvents();
        }

        public scrollLeft(): number {
            return this.__scrollLeft;
        }

        public scrollTop(): number {
            return this.__scrollTop;
        }

        public dispose(): void {
            if (this.__observer) {
                this.__observer.disconnect();
            }
            this.__event.off();
            this.__host.removeChild(this.__scrollbar);
        }

        public update(option?: any): void {
            const host: HTMLElement = this.__host;
            if (option) {
                this._extend(this.__option, option);
            }
            option = this.__option;

            let containerRect: any;
            let contentSize: any;
            if (option.containerRect) {
                containerRect = option.containerRect;
                contentSize = option.contentSize;
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

            const trackXStyle: CSSStyleDeclaration = this._getStyle(this.__trackX);
            this.__trackXMarginWidth = this._toInt(trackXStyle.marginLeft) + this._toInt(trackXStyle.marginRight);
            this.__trackXWidth = this.__containerWidth - this.__trackXMarginWidth;

            const trackYStyle: CSSStyleDeclaration = this._getStyle(this.__trackY);
            this.__trackYMarginHeight = this._toInt(trackYStyle.marginTop) + this._toInt(trackYStyle.marginBottom);
            this.__trackYHeight = this.__containerHeight - this.__trackYMarginHeight;

            const xscroll: boolean = (option.xscroll === false ? false : true);
            const yscroll: boolean = (option.yscroll === false ? false : true);
            // scroll X
            if (xscroll && this.__contentWidth > this.__containerWidth + 0.5) {
                this.__isScrollXActive = true;
                this.__trackXWidth = this.__containerWidth - this.__trackXMarginWidth;
                this.__thumbXWidth = this._getThumbXSize();
                this.__scrollbar.classList.add('dv-active-x');

                this._processXScrolled(this.__scrollLeft, 0);
            } else {
                this.__isScrollXActive = false;
                this.__trackXWidth = 0;
                this.__thumbXWidth = 0;
                this.__scrollbar.classList.remove('dv-active-x');

                this._processXScrolled(0, 0); // always make scrollLeft=0
            }
            // scroll Y
            if (yscroll && this.__contentHeight > this.__containerHeight + 0.5) {
                this.__isScrollYActive = true;
                this.__trackYHeight = this.__containerHeight - this.__trackYMarginHeight;
                this.__thumbYHeight = this._getThumbYSize();
                this.__scrollbar.classList.add('dv-active-y');

                this._processYScrolled(this.__scrollTop, 0);
            } else {
                this.__isScrollYActive = false;
                this.__trackYHeight = 0;
                this.__thumbYHeight = 0;
                this.__scrollbar.classList.remove('dv-active-y');

                this._processYScrolled(0, 0); // always make scrollTop=0
            }
        }

        private _updatePosition(): void {
            const host: HTMLElement = this.__host;
            const option: any = this.__option;

            if (this.__isScrollXActive) {
                this.__thumbXLeft = this.__scrollLeft * (this.__trackXWidth - this.__thumbXWidth) / (this.__contentWidth - this.__containerWidth);
            } else {
                this.__thumbXLeft = 0;
            }

            if (this.__isScrollYActive) {
                this.__thumbYTop = this.__scrollTop * (this.__trackYHeight - this.__thumbYHeight) / (this.__contentHeight - this.__containerHeight);
            } else {
                this.__thumbYTop = 0;
            }

            this.__thumbXLeft = Math.min(this.__thumbXLeft, this.__trackXWidth - this.__thumbXWidth);
            this.__thumbYTop = Math.min(this.__thumbYTop, this.__trackYHeight - this.__thumbYHeight);

            // update css
            const trackXOffset: any = option.trackXOffset ? option.trackXOffset : 0;
            const trackYOffset: any = option.trackYOffset ? option.trackYOffset : 0;
            this._setCss(this.__scrollbar, {
                left: host.scrollLeft + this.__containerLeft,
                top: host.scrollTop + this.__containerTop
            });
            this._setCss(this.__trackX, {
                left: 0,
                top: this.__containerHeight - this.__trackX.offsetHeight + trackXOffset,
                width: this.__trackXWidth
            });
            this._setCss(this.__thumbX, {
                left: this.__thumbXLeft,
                width: this.__thumbXWidth
            });
            this._setCss(this.__trackY, {
                left: this.__containerWidth - this.__trackY.offsetWidth + trackYOffset,
                top: 0,
                height: this.__trackYHeight
            });
            this._setCss(this.__thumbY, {
                top: this.__thumbYTop,
                height: this.__thumbYHeight
            });
        }

        //
        public on(type: string, fn: any): void {
            this.__event.object(this).on(type, fn);
        }

        public once(type: string, fn: any): void {
            this.__event.object(this).once(type, fn);
        }

        public off(type: string): void {
            this.__event.object(this).off(type);
        }

        private _fire(type: string, data: any): void {
            this.__event.object(this).fire(type, data);
        }

        private _bindEvents(): void {
            const evt: EventManager = this.__event;

            // size
            evt.element(window).on('resize', (e: UIEvent) => this._onWindowResize(e));

            // document keydown
            evt.element(this.__host.ownerDocument).on('keydown', (e: KeyboardEvent) => this._onDocumentKeyDown(e));

            // host content change
            let MutationObserver: any = null;
            if ((<any>window).MutationObserver) {
                MutationObserver = (<any>window).MutationObserver;
            } else if ((<any>window).WebKitMutationObserver) {
                MutationObserver = (<any>window).WebKitMutationObserver
            } else if ((<any>window).WebKitMutationObserver) {
                MutationObserver = (<any>window).MozMutationObserver;
            }
            if (MutationObserver) {
                this.__observer = new MutationObserver((mutations: any) => this._onHostChildrenChange(mutations));
                this.__observer.observe(this.__host, { subtree: true, childList: true });
            }

            // host
            const hostEvent: EventElement = evt.element(this.__host);
            hostEvent.on('scroll', (e: UIEvent) => this._onHostScroll(e));
            hostEvent.on('wheel', (e: WheelEvent) => this._onHostMouseWheel(e));
            hostEvent.on(TOUCH_TYPES.TOUCH_START, (e: TouchEvent) => this._onHostTouchStart(e));
            hostEvent.on('mouseenter', (e: MouseEvent) => this._onHostMouseEnter(e));
            hostEvent.on('mouseleave', (e: MouseEvent) => this._onHostMouseLeave(e));
            hostEvent.on('mousemove', (e: MouseEvent) => this._onHostMouseMove(e));

            // mouse
            evt.element(this.__trackX).on('mousedown', (e: MouseEvent) => this._onTrackXMouseDown(e));
            evt.element(this.__thumbX).on('mousedown', (e: MouseEvent) => this._onThumbXMouseDown(e));
            evt.element(this.__trackY).on('mousedown', (e: MouseEvent) => this._onTrackYMouseDown(e));
            evt.element(this.__thumbY).on('mousedown', (e: MouseEvent) => this._onThumbYMouseDown(e));

            evt.element(this.__scrollbar).on('click mousemove', (e: MouseEvent) => this._cancelEvent(e));
        }

        private _onHostChildrenChange(mutations: any): void {
            this.update();
        }

        private _onWindowResize(event: UIEvent): void {
            this.update();
        }

        private _onDocumentKeyDown(event: KeyboardEvent): void {
            if (((<any>event).isDefaultPrevented && (<any>event).isDefaultPrevented()) || event.defaultPrevented) {
                return;
            }

            let eMatches: ElementMatchesCallback = null;
            if (Element) {
                if (Element.prototype.matches) {
                    eMatches = Element.prototype.matches;
                } else if (Element.prototype.webkitMatchesSelector) {
                    eMatches = Element.prototype.webkitMatchesSelector;
                } else if (Element.prototype.msMatchesSelector) {
                    eMatches = Element.prototype.msMatchesSelector;
                }
            }

            const scrollbarFocused: any = eMatches.call(this.__thumbX, ':focus') ? eMatches.call(this.__thumbX, ':focus') : eMatches.call(this.__thumbY, ':focus');
            const hostHovered: boolean = this.__scrollbar.classList.contains('dv-hover');
            if (!hostHovered && !scrollbarFocused) {
                return;
            }

            let activeElement: Element = document.activeElement ? document.activeElement : this.__host.ownerDocument.activeElement;
            if (activeElement) {
                if (activeElement.tagName === 'IFRAME') {
                    activeElement = (<HTMLFrameElement>activeElement).contentDocument.activeElement;
                }

                if (eMatches.call(activeElement, 'input,[contenteditable]')
                    || eMatches.call(activeElement, 'select,[contenteditable]')
                    || eMatches.call(activeElement, 'textarea,[contenteditable]')
                    || eMatches.call(activeElement, 'button,[contenteditable]')) {
                    return;
                }
            }

            let deltaX: number = 0;
            let deltaY: number = 0;

            switch (event.which) {
                case 37: // left:
                    deltaX = -40;
                    break;
                case 39: // right
                    deltaX = 40;
                    break;
                case 38: // up
                    deltaY = 40;
                    break;
                case 40: // down
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

            const newScrollTop: number = this.__scrollTop - deltaY;
            const newScrollLeft: number = this.__scrollLeft + deltaX;

            let shouldPreventDefault: boolean = false;
            if (this.__isScrollYActive) {
                this._processYScrolled(newScrollTop);
                shouldPreventDefault = true;
            } else if (this.__isScrollXActive) {
                this._processXScrolled(newScrollLeft);
                shouldPreventDefault = true;
            }
            if (shouldPreventDefault) {
                this._cancelEvent(event);
            }
        }

        private _onHostScroll(event: UIEvent): void {
            const host: HTMLElement = this.__host;
            if (!this._isRangeScroll()) {
                this.__scrollTop = host.scrollTop;
                this.__scrollLeft = host.scrollLeft;
            }

            this._updatePosition();
        }

        private _onHostMouseEnter(event: MouseEvent): void {
            if (!this._isRangeScroll()) {
                this.__scrollbar.classList.add('dv-hover');
                this._updatePosition();
            }
        }

        private _onHostMouseLeave(event: MouseEvent): void {
            this.__scrollbar.classList.remove('dv-hover');
            this._updatePosition();
        }

        private _onHostMouseMove(event: MouseEvent): void {
            if (this._isRangeScroll()) {
                if (this._mouseInContainer(event)) {
                    this.__scrollbar.classList.add('dv-hover');
                } else {
                    this.__scrollbar.classList.remove('dv-hover');
                }

                this._updatePosition();
            }
        }

        private _onHostMouseWheel(event: WheelEvent): void {
            if (!this._mouseInContainer(event)) {
                return;
            }

            const wheelDelta: { deltaX: number, deltaY: number } = this._getWheelDelte(event);
            const deltaX: number = wheelDelta.deltaX;
            const deltaY: number = wheelDelta.deltaY;

            const newScrollTop: number = this.__scrollTop - deltaY;
            const newScrollLeft: number = this.__scrollLeft + deltaX;

            let shouldPreventDefault: boolean = false;

            if (this.__isScrollYActive && deltaY !== 0) {
                this._processYScrolled(newScrollTop);
                shouldPreventDefault = true;
            } else if (this.__isScrollXActive && deltaX !== 0) {
                this._processXScrolled(newScrollLeft);
                shouldPreventDefault = true;
            }

            if (shouldPreventDefault) {
                this._cancelEvent(event);
            }
        }

        private _getWheelDelte(orgEvent: WheelEvent): { deltaX: number, deltaY: number } {
            let deltaX: number = 0;
            let deltaY: number = 0;

            // Old school scrollwheel delta
            // if ('detail' in orgEvent) {
            //     deltaY = orgEvent.detail * -1;
            // }
            // if ('wheelDelta' in orgEvent) {
            //     deltaY = orgEvent.wheelDelta;
            // }
            // if ('wheelDeltaY' in orgEvent) {
            //     deltaY = orgEvent.wheelDeltaY;
            // }
            // if ('wheelDeltaX' in orgEvent) {
            //     deltaX = orgEvent.wheelDeltaX * -1;
            // }

            // New school wheel delta (wheel event)
            if (_Util.hasProperty(orgEvent, 'deltaY')) {
                deltaY = orgEvent.deltaY * -1;
            }
            if (_Util.hasProperty(orgEvent, 'deltaX')) {
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

            return { deltaX: deltaX, deltaY: deltaY };
        }

        private _mouseInContainer(event: MouseEvent): boolean {
            if (this._isRangeScroll()) {
                const hostRect: ClientRect | DOMRect = this.__host.getBoundingClientRect();

                const option: any = this.__option;
                const trackXOffset: any = option.trackXOffset ? option.trackXOffset : 0;
                const trackYOffset: any = option.trackYOffset ? option.trackYOffset : 0;

                const evtX: number = event.pageX - hostRect.left;
                const evtY: number = event.pageY - hostRect.top;
                if ((this.__containerLeft <= evtX && evtX < this.__containerLeft + this.__containerWidth + trackYOffset) &&
                    (this.__containerTop <= evtY && evtY < this.__containerTop + this.__containerHeight + trackXOffset)) {
                    return true;
                }
                return false;
            }
            return true;
        }

        private _onHostTouchStart(event: TouchEvent): void {
            const self: Scrollbar = this;

            if (self.__touchIntervalId) {
                clearInterval(self.__touchIntervalId);
            }

            //
            if (!this.__isScrollXActive && !this.__isScrollYActive) {
                return;
            }
            if (!this._shouldHandleTouch(event)) {
                return;
            }

            const touch: any = event.targetTouches ? event.targetTouches[0] : event;
            if (!this._mouseInContainer(touch)) {
                return;
            }

            //
            let startOffset: any = {};
            let startTime: number = new Date().getTime();
            const speed: any = {};

            startOffset.pageX = touch.pageX;
            startOffset.pageY = touch.pageY;

            //
            const hostEvent: EventElement = self.__event.element(self.__host);
            //
            hostEvent.off(TOUCH_TYPES.TOUCH_MOVE);
            hostEvent.on(TOUCH_TYPES.TOUCH_MOVE, touchMoveHandler);
            function touchMoveHandler(e: TouchEvent): void {
                if (!self._shouldHandleTouch(e)) {
                    return;
                }
                const touch1: any = e.targetTouches ? e.targetTouches[0] : e;

                const currentOffset: { pageX: number, pageY: number } = { pageX: touch1.pageX, pageY: touch1.pageY };

                const differenceX: number = currentOffset.pageX - startOffset.pageX;
                const differenceY: number = currentOffset.pageY - startOffset.pageY;

                const newScrollTop: number = self.__scrollTop - differenceY;
                const newScrollLeft: number = self.__scrollLeft - differenceX;

                let shouldPreventDefault: boolean = false;
                if (self.__isScrollYActive) {
                    self._processYScrolled(newScrollTop);
                    shouldPreventDefault = true;
                } else if (self.__isScrollXActive) {
                    self._processXScrolled(newScrollLeft);
                    shouldPreventDefault = true;
                }
                if (shouldPreventDefault) {
                    self._cancelEvent(e);
                }

                startOffset = currentOffset;

                const currentTime: number = new Date().getTime();
                const timeGap: number = currentTime - startTime;
                if (timeGap > 0) {
                    speed.x = differenceX / timeGap;
                    speed.y = differenceY / timeGap;
                    startTime = currentTime;
                }
            }
            //
            hostEvent.off(TOUCH_TYPES.TOUCH_END);
            hostEvent.on(TOUCH_TYPES.TOUCH_END, touchEndHandler);
            function touchEndHandler(e: TouchEvent): void {
                hostEvent.off(TOUCH_TYPES.TOUCH_MOVE);
                hostEvent.off(TOUCH_TYPES.TOUCH_END);

                clearInterval(self.__touchIntervalId);
                self.__touchIntervalId = setInterval((): void => {
                    if (!speed.x && !speed.y) {
                        clearInterval(self.__touchIntervalId);
                        return;
                    }

                    if (Math.abs(speed.x) < 0.01 && Math.abs(speed.y) < 0.01) {
                        clearInterval(self.__touchIntervalId);
                        return;
                    }

                    const newScrollTop: number = self.__scrollTop - speed.y * 30;
                    const newScrollLeft: number = self.__scrollLeft - speed.x * 30;

                    if (self.__isScrollYActive) {
                        self._processYScrolled(newScrollTop);
                    } else if (self.__isScrollXActive) {
                        self._processXScrolled(newScrollLeft);
                    }

                    speed.x *= 0.8;
                    speed.y *= 0.8;
                }, 10);
            }
        }

        private _shouldHandleTouch(event: any): boolean {
            if (event.pointerType && event.pointerType === 'pen' && event.buttons === 0) {
                return false;
            }
            if (event.targetTouches && event.targetTouches.length === 1) {
                return true;
            }
            if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== event.MSPOINTER_TYPE_MOUSE) {
                return true;
            }
            return false;
        }

        private _onTrackXMouseDown(event: MouseEvent): void {
            const thumbXRect: ClientRect | DOMRect = this.__thumbX.getBoundingClientRect();
            const evtX: number = event.pageX - window.pageXOffset;

            const direction: number = evtX < thumbXRect.left ? -1 : 1;
            const newScrollLeft: number = this.__scrollLeft + direction * this.__containerWidth;

            this._processXScrolled(newScrollLeft);

            this._cancelEvent(event);
        }

        private _onThumbXMouseDown(event: MouseEvent): void {
            const self: Scrollbar = this;
            const startScrollLeft: number = self.__scrollLeft;
            const startPageX: number = event.pageX;
            const scrollBy: number = (self.__contentWidth - self.__containerWidth) / (self.__trackXWidth - self.__thumbXWidth);

            //
            const doc: any = self.__host.ownerDocument;
            const docEvent: EventElement = self.__event.element(doc);
            docEvent.on('mousemove', mouseMoveHandler, true);
            function mouseMoveHandler(e: MouseEvent): void {
                const newScrollLeft: number = startScrollLeft + scrollBy * (e.pageX - startPageX);
                self._processXScrolled(newScrollLeft);
                self.__scrollbar.classList.add('dv-scrolling-x');

                self._cancelEvent(e);
            }
            docEvent.on('mouseup', mouseUpHandler, true);
            function mouseUpHandler(): void {
                self.__event.off(doc);

                self.__scrollbar.classList.remove('dv-scrolling-x');
                self._updatePosition();
            }

            self._cancelEvent(event);
        }

        private _onTrackYMouseDown(event: MouseEvent): void {
            const thumbYRect: ClientRect | DOMRect = this.__thumbY.getBoundingClientRect();
            const evtY: number = event.pageY - window.pageYOffset;

            const direction: number = evtY < thumbYRect.top ? -1 : 1;
            const newScrollTop: number = this.__scrollTop + direction * this.__containerHeight;

            this._processYScrolled(newScrollTop);

            this._cancelEvent(event);
        }

        private _onThumbYMouseDown(event: MouseEvent): void {
            const self: Scrollbar = this;
            const startScrollTop: number = self.__scrollTop;
            const startPageY: number = event.pageY;
            const scrollBy: number = (self.__contentHeight - self.__containerHeight) / (self.__trackYHeight - self.__thumbYHeight);

            //
            const doc: any = self.__host.ownerDocument;
            const docEvent: EventElement = self.__event.element(doc);
            docEvent.on('mousemove', mouseMoveHandler, true);
            function mouseMoveHandler(e: MouseEvent): void {
                const newScrollTop: number = startScrollTop + scrollBy * (e.pageY - startPageY);
                self._processYScrolled(newScrollTop);
                self.__scrollbar.classList.add('dv-scrolling-y');

                self._cancelEvent(e);
            }
            docEvent.on('mouseup', mouseUpHandler, true);
            function mouseUpHandler(): void {
                self.__event.off(doc);

                self.__scrollbar.classList.remove('dv-scrolling-y');
                self._updatePosition();
            }

            self._cancelEvent(event);
        }

        private _cancelEvent(event: MouseEvent | KeyboardEvent | TouchEvent): void {
            event.preventDefault();
            event.stopPropagation();
        }

        //
        private _processXScrolled(newScrollLeft: number, delay: number = 10): void {
            const self: Scrollbar = this;
            if (self.__scrollXTimeoutId) {
                window.clearTimeout(self.__scrollXTimeoutId);
            }

            if (delay == 0) {
                scroll();
            } else {
                self.__scrollXTimeoutId = window.setTimeout(() => {
                    scroll();
                }, delay);
            }

            function scroll(): void {
                newScrollLeft = Math.max(0, Math.min(newScrollLeft, self.__contentWidth - self.__containerWidth));
                const diff: number = self.__scrollLeft - newScrollLeft;
                if (diff) {
                    const oldScrollLeft: number = self.__scrollLeft;
                    self.__scrollLeft = newScrollLeft;
                    if (!self._isRangeScroll()) {
                        self.__host.scrollLeft = newScrollLeft;
                    }
                    self._fire(Scrollbar.__scrolled, {
                        scrollOrientation: ScrollOrientation.HorizontalScroll,
                        newValue: self.__scrollLeft,
                        oldValue: oldScrollLeft
                    });
                }

                self._updatePosition();
                self.__scrollXTimeoutId = null;
            }
        }

        private _processYScrolled(newScrollTop: number, delay: number = 10): void {
            const self: Scrollbar = this;
            if (self.__scrollYTimeoutId) {
                window.clearTimeout(self.__scrollYTimeoutId);
            }

            if (delay == 0) {
                scroll();
            } else {
                self.__scrollYTimeoutId = window.setTimeout(() => {
                    scroll();
                }, delay);
            }

            function scroll(): void {
                newScrollTop = Math.max(0, Math.min(newScrollTop, self.__contentHeight - self.__containerHeight));
                const diff: number = self.__scrollTop - newScrollTop;
                if (diff) {
                    const oldScrollTop: number = self.__scrollTop;
                    self.__scrollTop = newScrollTop;

                    if (!self._isRangeScroll()) {
                        self.__host.scrollTop = newScrollTop;
                    }

                    self._fire(Scrollbar.__scrolled, {
                        scrollOrientation: ScrollOrientation.VerticalScroll,
                        newValue: self.__scrollTop,
                        oldValue: oldScrollTop
                    });
                }

                self._updatePosition();
                self.__scrollYTimeoutId = null;
            }
        }

        //
        private _getThumbXSize(): number {
            return this.__trackXWidth * this.__containerWidth / this.__contentWidth;
        }

        private _getThumbYSize(): number {
            return (
                this.__trackYHeight * this.__containerHeight / this.__contentHeight
            );
        }

        //
        private _createElement(tag: string, className: string, style?: any): HTMLElement {
            const element: HTMLElement = document.createElement(tag);
            element.className = className;
            if (style) {
                this._setCss(element, style);
            };

            return element;
        }

        private _getStyle(element: HTMLElement): CSSStyleDeclaration {
            return getComputedStyle(element);
        }

        private _getCss(element: HTMLElement, propertyName: any): string {
            return this._getStyle(element)[propertyName];
        }

        private _setCss(element: HTMLElement, properties: any): void {
            const props: string[] = _Util.properties(properties, false);
            for (const key of props) {
                let v: any = properties[key];
                if (typeof v === 'number') {
                    v = v + 'px';
                }
                element.style[<any>key] = v;
            }
        }

        //
        private _isRangeScroll(): boolean {
            return !!(this.__option.containerRect);
        }
        private _toInt(v: string): number {
            return parseInt(v, 10) || 0;
        }
        private _extend(target: any, src: any): any {
            const props: string[] = _Util.properties(src);
            for (const p of props) {
                if (src.hasOwnProperty(p)) {
                    target[p] = src[p]
                };
            };
            return target;
        }
    }


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

        on(type: string, fn: any): void {
            this._bind(type, fn, false);
        }
        once(type: string, fn: any): void {
            this._bind(type, fn, true);
        }
        off(type: any): void {
            const events: any = this.__events;

            if (!type) {
                this.__events = {};
            } else if (typeof type === 'string') {
                delete events[type];
            } else if (typeof type === 'function') {
                const props: string[] = _Util.properties(events, false);
                for (const t of props) {
                    const fns: any = events[t] ? events[t] : [];
                    for (let i: number = 0; i < fns.length; i++) {
                        if (fns[i][0] === type) {
                            fns.splice(i--, 1);
                        }
                    }
                }
            }
        }
        fire(type: string, ...args: any[]): void {
            const fns: any = this.__events[type];
            if (!fns || fns.length === 0) {
                return;
            }

            for (let i: number = 0; i < fns.length; i++) {
                const fn: any = fns[i];
                fn[0].apply(this.__context, args);
                if (fn[1]) {
                    // once
                    fns.splice(i--, i);
                }
            }
        }

        _bind(type: string, fn: any, once: boolean): void {
            if (typeof type !== 'string' || typeof fn !== 'function') {
                return;
            }

            if (!this.__events[type]) {
                this.__events[type] = [];
            }
            this.__events[type].push([fn, once]);
        }
    }

    /**
     * @hidden
     * Represents html element's event.
     */
    export class EventElement {
        private __element: HTMLElement | Window | Document;
        private __events: any;

        constructor(element: HTMLElement | Window | Document) {
            this.__element = element;
            this.__events = {};
        }

        context(): HTMLElement | Window | Document {
            return this.__element;
        }

        on(type: string | string[], fn: any, capture?: boolean): void {
            if (typeof type !== 'string' || typeof fn !== 'function') {
                return;
            }

            capture = !!capture;
            const types: string[] = type.split(' ').filter((t) => t !== '');
            for (let i: number = 0; i < types.length; i++) {
                const t: string = types[i];
                if (!this.__events[t]) {
                    this.__events[t] = [];
                }
                this.__events[t].push({ fn: fn, capture: capture });
                this.__element.addEventListener(t, fn, capture);
            }
        }
        off(type: any): void {
            const events: any = this.__events;

            if (!type) {
                const props: string[] = _Util.properties(events, false);
                for (const t of props) {
                    const fns: any = events[t] ? events[t] : [];
                    for (let i: number = 0; i < fns.length; i++) {
                        this.__element.removeEventListener(t, fns[i].fn, fns[i].capture);
                    }
                }
                this.__events = {};
            } else if (typeof type === 'string') {
                const fns: any = events[type] ? events[type] : [];
                for (let i: number = 0; i < fns.length; i++) {
                    this.__element.removeEventListener(type, fns[i].fn, fns[i].capture);
                }
                delete events[type];
            } else if (typeof type === 'function') {
                const props: string[] = _Util.properties(events, false);
                for (const t of props) {
                    const fns: any = events[t] ? events[t] : [];
                    for (let i: number = 0; i < fns.length; i++) {
                        if (fns[i] === type) {
                            this.__element.removeEventListener(t, fns[i].fn, fns[i].capture);
                            fns.splice(i--, 1);
                        }
                    }
                }
            }
        }
    }

    /**
     * @hidden
     * Represents a customer event.
     */
    export class EventManager {
        private __events: any[];
        constructor() {
            this.__events = [];
        }

        element(element: HTMLElement | Window | Document): EventElement {
            let evt: any = this.__events.filter((item) => item.context() === element)[0];
            if (!evt) {
                evt = new EventElement(element);
                this.__events.push(evt);
            }
            return evt;
        }
        object(obj: any): EventObject {
            let evt: any = this.__events.filter((item) => item.context() === obj)[0];
            if (!evt) {
                evt = new EventObject(obj);
                this.__events.push(evt);
            }
            return evt;
        }

        off(context?: any): void {
            const events: any[] = this.__events;

            if (context) {
                for (let i: number = 0; i < events.length; i++) {
                    if (events[i].context() === context) {
                        events[i].off();
                        events.splice(i--, 1);
                    }
                }
            } else {
                for (let i: number = 0; i < events.length; i++) {
                    events[i].off();
                }
                this.__events = [];
            }
        }
    }

}
