    /**
     * body layout 뷰
     *
     * @constructor
     */
    View.Layout.Body = View.Base.extend({
        tagName: 'div',
        className: 'data',
        template: _.template('' +
                '<div class="table_container" style="top: 0px">' +
                '    <table width="100%" border="0" cellspacing="1" cellpadding="0" bgcolor="#EFEFEF">' +
                '        <colgroup><%=colGroup%></colgroup>' +
                '        <tbody></tbody>' +
                '    </table>' +
                '</div>'),
        events: {
            'scroll': '_onScroll',
            'mousedown': '_onMouseDown'
        },
        initialize: function(attributes) {
            View.Base.prototype.initialize.apply(this, arguments);
            this.setOwnProperties({
                whichSide: attributes && attributes.whichSide || 'R',
                isScrollSync: false
            });

            this.listenTo(this.grid.dimensionModel, 'columnWidthChanged', this._onColumnWidthChanged, this)
                .listenTo(this.grid.dimensionModel, 'change:bodyHeight', this._onBodyHeightChange, this)

                .listenTo(this.grid.renderModel, 'change:scrollTop', this._onScrollTopChange, this)
                .listenTo(this.grid.renderModel, 'change:scrollLeft', this._onScrollLeftChange, this)
                .listenTo(this.grid.renderModel, 'refresh', this._setTopPosition, this);
        },
        /**
         * DimensionModel 의 body Height 가 변경된 경우 element 의 height 를 조정한다.
         * @param {Object} model
         * @param {Number} value
         * @private
         */
        _onBodyHeightChange: function(model, value) {
            this.$el.css('height', value + 'px');
        },
        /**
         * columnWidth change 핸들러
         * @private
         */
        _onColumnWidthChanged: function() {
            var columnWidthList = this.grid.dimensionModel.getColumnWidthList(this.whichSide),
                $colList = this.$el.find('col');

            _.each(columnWidthList, function(width, index) {
                $colList.eq(index).css('width', width + 'px');
            });
        },
        /**
         * MouseDown event handler
         * @param {event} mouseDownEvent
         * @private
         */
        _onMouseDown: function(mouseDownEvent) {
            var grid = this.grid,
                selection = grid.selection,
                focused,
                pos;

            if (mouseDownEvent.shiftKey) {
                focused = grid.focusModel.indexOf(true);

                if (!selection.hasSelection()) {
                    selection.startSelection(focused.rowIdx, focused.columnIdx);
                }

                selection.attachMouseEvent(mouseDownEvent.pageX, mouseDownEvent.pageY);
                pos = selection.getIndexFromMousePosition(mouseDownEvent.pageX, mouseDownEvent.pageY);
                selection.updateSelection(pos.row, pos.column);
                grid.focusAt(pos.row, pos.column);
            } else {
                selection.endSelection();
                selection.attachMouseEvent(mouseDownEvent.pageX, mouseDownEvent.pageY);
            }
        },
        /**
         * Scroll Event Handler
         * @param {event} scrollEvent
         * @private
         */
        _onScroll: function(scrollEvent) {
            var obj = {},
                renderModel = this.grid.renderModel;

            obj['scrollTop'] = scrollEvent.target.scrollTop;

            if (this.whichSide === 'R') {
                obj['scrollLeft'] = scrollEvent.target.scrollLeft;
            }
            renderModel.set(obj);
        },
        /**
         * Render model 의 Scroll left 변경 핸들러
         * @param {object} model
         * @param {Number} value
         * @private
         */
        _onScrollLeftChange: function(model, value) {
            /* istanbul ignore next: 부모 frame 이 없는 상태에서 테스트가 불가함*/
            if (this.whichSide === 'R') {
                this.el.scrollLeft = value;
            }
        },
        /**
         * Render model 의 Scroll top 변경 핸들러
         * @param {object} model
         * @param {Number} value
         * @private
         */
        _onScrollTopChange: function(model, value) {
            /* istanbul ignore next: 부모 frame 이 없는 상태에서 테스트가 불가함*/
            this.el.scrollTop = value;
        },
        /**
         * rowList 가 rendering 될 때 top 값을 조정한다.
         * @param {number} top
         * @private
         */
        _setTopPosition: function(top) {
            this.$el.children('.table_container').css('top', top + 'px');
        },
        /**
         * rendering 한다.
         * @return {View.Layout.Body}
         */
        render: function() {
            var grid = this.grid,
                whichSide = this.whichSide,
                selection,
                rowList,
                collection = grid.renderModel.getCollection(whichSide);

            this.destroyChildren();

            this.$el.css({
                    height: grid.dimensionModel.get('bodyHeight')
                }).html(this.template({
                    colGroup: this._getColGroupMarkup()
                }));

            rowList = this.createView(View.RowList, {
                grid: grid,
                collection: collection,
                el: this.$el.find('tbody'),
                whichSide: whichSide
            });
            rowList.render();

            //selection 을 랜더링한다.
            selection = this.addView(grid.selection.createLayer(whichSide));
            this.$el.append(selection.render().el);

            return this;
        },
        /**
         * Table 열 각각의 width 조정을 위한 columnGroup 마크업을 반환한다.
         * @return {string}
         * @private
         */
        _getColGroupMarkup: function() {
            var grid = this.grid,
                whichSide = this.whichSide,
                columnModel = grid.columnModel,
                dimensionModel = grid.dimensionModel,
                columnWidthList = dimensionModel.getColumnWidthList(whichSide),
                columnModelList = columnModel.getVisibleColumnModelList(whichSide),
                html = '';

            _.each(columnModelList, function(columnModel, index) {
                html += '<col columnname="' + columnModel['columnName'] + '" style="width:' + columnWidthList[index]+ 'px">';
            });
            return html;
        }
    });