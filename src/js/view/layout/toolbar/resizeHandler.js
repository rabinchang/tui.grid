/**
 * @fileoverview Class for the resize handler of the toolbar
 * @author NHN Ent. FE Development Team
 */
'use strict';

var View = require('../../../base/view');
var classNameConst = require('../../../common/classNameConst');

/**
 * Class for the resize handler of the toolbar
 * @module view/layout/toolbar/resizeHandler
 * @extends module:base/view
 */
var ResizeHandler = View.extend(/**@lends module:view/layout/toolbar/resizeHandler.prototype */{
    /**
     * @constructs
     * @param {Object} options - Options
     */
    initialize: function(options) {
        this.dimensionModel = options.dimensionModel;
        this.timeoutIdForResize = 0;
    },

    className: classNameConst.TOOLBAR_RESIZE_BAR,

    htmlString: '<a href="#" class="' + classNameConst.TOOLBAR_RESIZE_HANDLE + '"><span></span></a>',

    events: {
        'mousedown': '_onMouseDown'
    },

    /**
     * document 에 mousemove, mouseup 이벤트 핸들러를 추가한다.
     * @private
     */
    _attachMouseEvent: function() {
        $(document).on('mousemove', $.proxy(this._onMouseMove, this));
        $(document).on('mouseup', $.proxy(this._onMouseUp, this));
        $(document).on('selectstart', $.proxy(this._onSelectStart, this));
    },

    /**
     * document 에 mousemove, mouseup 이벤트 핸들러를 추가한다.
     * @private
     */
    _detachMouseEvent: function() {
        $(document).off('mousemove', $.proxy(this._onMouseMove, this));
        $(document).off('mouseup', $.proxy(this._onMouseUp, this));
        $(document).off('selectstart', $.proxy(this._onSelectStart, this));
    },

    /**
     * mousedown 이벤트 핸들러
     * @param {event} mouseDownEvent 마우스 이벤트
     * @private
     */
    _onMouseDown: function(mouseDownEvent) {
        mouseDownEvent.preventDefault();
        $(document.body).css('cursor', 'row-resize');
        this._attachMouseEvent();
    },

    /**
     * mousemove 이벤트 핸들러
     * @param {event} mouseMoveEvent 마우스 이벤트
     * @private
     */
    _onMouseMove: function(mouseMoveEvent) {
        var dimensionModel = this.dimensionModel,
            offsetTop = dimensionModel.get('offsetTop'),
            headerHeight = dimensionModel.get('headerHeight'),
            rowHeight = dimensionModel.get('rowHeight'),
            toolbarHeight = dimensionModel.get('toolbarHeight'),
            bodyHeight = mouseMoveEvent.pageY - offsetTop - headerHeight - toolbarHeight;

        clearTimeout(this.timeoutIdForResize);

        bodyHeight = Math.max(bodyHeight, rowHeight + dimensionModel.getScrollXHeight());

        //매번 수행하면 성능이 느려지므로, resize 이벤트가 발생할 시 천천히 업데이트한다.
        this.timeoutIdForResize = setTimeout(function() {
            dimensionModel.set({
                bodyHeight: bodyHeight
            });
        }, 0);
    },

    /**
     * mouseup 이벤트 핸들러
     * @private
     */
    _onMouseUp: function() {
        $(document.body).css('cursor', 'default');
        this._detachMouseEvent();
    },

    /**
     * selection start 이벤트 핸들러
     * @param {Event} event - Event object
     * @returns {boolean} - 기본 동작 방지를 위해 무조건 false 를 반환한다.
     * @private
     */
    _onSelectStart: function(event) {
        event.preventDefault();
        return false;
    },

    /**
     * 랜더링한다.
     * @returns {ResizeHandler} this object
     */
    render: function() {
        this._destroyChildren();
        this.$el.html(this.htmlString);

        return this;
    },

    /**
     * 소멸자
     */
    destroy: function() {
        this.stopListening();
        this._onMouseUp();
        this._destroyChildren();
        this.remove();
    }
});

module.exports = ResizeHandler;
