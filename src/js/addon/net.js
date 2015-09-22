/**
 * @fileoverview Network 모듈 addon
 * @author NHN Ent. FE Development Team
 */
'use strict';

var View = require('../base/view');
var Router = require('./net-router');
var util = require('../util');

/**
 * Network 모듈 addon
 * @param {object} options
 *      @param {jquery} options.el   form 엘리먼트
 *      @param {boolean} [options.initialRequest=true]   Net 인스턴스 생성과 동시에 readData request 요청을 할 지 여부.
 *      @param {object} [options.api]   사용할 API URL 리스트
 *          @param {string} [options.api.readData]  데이터 조회 API 주소
 *          @param {string} [options.api.createData] 데이터 생성 API 주소
 *          @param {string} [options.api.updateData] 데이터 업데이트 API 주소
 *          @param {string} [options.api.modifyData] 데이터 수정 API 주소 (생성/조회/삭제 한번에 처리하는 API 주소)
 *          @param {string} [options.api.deleteData] 데이터 삭제 API 주소
 *      @param {number} [options.perPage=500]  한 페이지당 보여줄 item 개수
 *      @param {boolean} [options.enableAjaxHistory=true]   ajaxHistory 를 사용할지 여부
 * @constructor AddOn.Net
 * @example
 <form id="data_form">
 <input type="text" name="query"/>
 </form>
 <script>
 var net,
 grid = new ne.Grid({
        //...option 생략...
});

 //Net AddOn 을 그리드 내부에서 인스턴스화 하며 초기화 한다.
 grid.use('Net', {
    el: $('#data_form'),         //필수 - form 엘리먼트
    initialRequest: true,   //(default: true) Net 인스턴스 생성과 동시에 readData request 요청을 할 지 여부.
    perPage: 500,           //(default: 500) 한 페이지당 load 할 데이터 개수
    enableAjaxHistory: true, //(default: true) ajaxHistory 를 사용할지 여부
    //사용할 API URL 리스트
    api: {
        'readData': './api/read',       //데이터 조회 API 주소
        'createData': './api/create',   //데이터 생성 API 주소
        'updateData': './api/update',   //데이터 업데이트 API 주소
        'deleteData': './api/delete',   //데이터 삭제 API 주소
        'modifyData': './api/modify'    //데이터 수정 API 주소 (생성/조회/삭제 한번에 처리하는 API 주소)
    }
});
 //이벤트 핸들러 바인딩
 grid.on('beforeRequest', function(data) {
    //모든 dataRequest 시 호출된다.
}).on('response', function(data) {
    //response 이벤트 핸들러
    //성공/실패와 관계없이 response 를 받을 떄 호출된다.
}).on('successResponse', function(data) {
    //successResponse 이벤트 핸들러
    //response.result 가 true 일 때 호출된다.
}).on('failResponse', function(data) {
    //failResponse 이벤트 핸들러
    //response.result 가 false 일 때 호출된다.
}).on('errorResponse', function(data) {
    //ajax error response 이벤트 핸들러
});

 //grid 로부터 사용할 net 인스턴스를 가져온다.
 net = grid.getAddOn('Net');

 //request 관련 자세한 옵션은 Net#request 를 참고한다.
 //createData API 요청
 net.request('createData');

 //updateData API 요청
 net.request('updateData');

 //deleteData API 요청
 net.request('deleteData');

 //modifyData API 요청
 net.request('modifyData');
 </script>
 */

var Net = View.extend(/**@lends AddOn.Net.prototype */{
    tagName: 'form',
    events: {
        submit: '_onSubmit'
    },
    /**
     * 생성자
     * @param {Object} attributes 생성자 option 정보
     */
    initialize: function(attributes) {
        var defaultOptions, options, pagination;

        View.prototype.initialize.apply(this, arguments);

        defaultOptions = {
            initialRequest: true,
            api: {
                readData: '',
                createData: '',
                updateData: '',
                deleteData: '',
                modifyData: '',
                downloadData: '',
                downloadAllData: ''
            },
            perPage: 500,
            enableAjaxHistory: true
        };
        options = $.extend(true, defaultOptions, attributes); // deep extend
        pagination = this.grid.getPaginationInstance();

        this.setOwnProperties({
            curPage: 1,
            perPage: options.perPage,
            options: options,
            router: null,
            pagination: pagination,
            requestedFormData: null,
            isLocked: false,
            lastRequestedReadData: null
        });
        this._initializeDataModelNetwork();
        this._initializeRouter();
        this._initializePagination();

        this.listenTo(this.grid.dataModel, 'sortChanged', this._onSortChanged, this);

        if (options.initialRequest) {
            this._readDataAt(1, false);
        }
    },
    /**
     * pagination instance 를 초기화 한다.
     * @private
     */
    _initializePagination: function() {
        var pagination = this.pagination;
        if (pagination) {
            pagination.setOption('itemPerPage', this.perPage);
            pagination.setOption('itemCount', 1);
            pagination.on('beforeMove', $.proxy(this._onPageBeforeMove, this));
        }
    },
    /**
     * dataModel 이 network 통신을 할 수 있도록 설정한다.
     * @private
     */
    _initializeDataModelNetwork: function() {
        this.grid.dataModel.url = this.options.api.readData;
        this.grid.dataModel.sync = $.proxy(this._sync, this);
    },
    /**
     * ajax history 를 사용하기 위한 router 를 초기화한다.
     * @private
     */
    _initializeRouter: function() {
        if (this.options.enableAjaxHistory) {
            //router 생성
            this.router = new Router({
                grid: this.grid,
                net: this
            });
            if (!Backbone.History.started) {
                Backbone.history.start();
            }
        }
    },
    /**
     * pagination 에서 before page move가 발생했을 때 이벤트 핸들러
     * @param {{page:number}} customEvent pagination 으로부터 전달받는 이벤트 객체
     * @private
     */
    _onPageBeforeMove: function(customEvent) {
        var page = customEvent.page;
        if (this.curPage !== page) {
            this._readDataAt(page, true);
        }
    },
    /**
     * form 의 submit 이벤트 발생시 이벤트 핸들러
     * @param {event} submitEvent   submit 이벤트 객체
     * @private
     */
    _onSubmit: function(submitEvent) {
        submitEvent.preventDefault();
        /*
        page 이동시 form input 을 수정하더라도,
        formData 를 유지하기 위해 데이터를 기록한다.
         */
        this._readDataAt(1, false);
    },

    /**
     * 폼 데이터를 설정한다.
     * 내부에서 사용하는 메서드이므로 외부에서 사용하지 않기를 권장한다.
     * @param {Object} formData 폼 데이터 정보
     */
    setFormData: function(formData) {
        //form data 를 실제 form 에 반영한다.
        /* istanbul ignore next */
        util.form.setFormData(this.$el, formData);
    },

    /**
     * fetch 수행 이후 custom ajax 동작 처리를 위해 Backbone 의 기본 sync 를 오버라이드 하기위한 메서드.
     * @param {String} method   router 로부터 전달받은 method 명
     * @param {Object} model    fetch 를 수행한 dataModel
     * @param {Object} options  request 정보
     * @private
     */
    _sync: function(method, model, options) {
        var params;
        if (method === 'read') {
            options = options || {};
            params = $.extend({}, options);
            if (!options.url) {
                params.url = _.result(model, 'url');
            }
            this._ajax(params);
        } else {
            Backbone.sync.call(Backbone, method, model, options);
        }
    },
    /**
     * network 통신에 대한 _lock 을 건다.
     * @private
     */
    _lock: function() {
        this.grid.showGridLayer('loading');
        this.isLocked = true;
    },
    /**
     * network 통신에 대해 unlock 한다.
     * loading layer hide 는 rendering 하는 로직에서 수행한다.
     * @private
     */
    _unlock: function() {
        this.isLocked = false;
    },

    /**
     * form 으로 지정된 엘리먼트의 Data 를 반환한다.
     * @return {object} formData 데이터 오브젝트
     * @private
     */
    _getFormData: function() {
        /* istanbul ignore next*/
        return util.form.getFormData(this.$el);
    },
    /**
     * DataModel 에서 Backbone.fetch 수행 이후 success 콜백
     * @param {object} dataModel grid 의 dataModel
     * @param {object} responseData 응답 데이터
     * @private
     */
    _onReadSuccess: function(dataModel, responseData) {
        var pagination = this.pagination,
            page, totalCount;

        dataModel.setOriginalRowList();

        //pagination 처리
        if (pagination && responseData.pagination) {
            page = responseData.pagination.page;
            totalCount = responseData.pagination.totalCount;
            pagination.setOption('itemPerPage', this.perPage);
            pagination.setOption('itemCount', totalCount);
            pagination.movePageTo(page);
            this.curPage = page;
        }
    },
    /**
     * DataModel 에서 Backbone.fetch 수행 이후 error 콜백
     * @param {object} dataModel grid 의 dataModel
     * @param {object} responseData 응답 데이터
     * @param {object} options  ajax 요청 정보
     * @private
     */
    _onReadError: function(dataModel, responseData, options) {}, // eslint-disable-line

    /**
     * 가장 마지막에 조회 요청한 request 파라미터로 다시 요청한다.
     */
    reloadData: function() {
        this.readData(this.lastRequestedReadData);
    },
    /**
     * 데이터 조회 요청.
     * 내부적으로 사용하는 메서드이므로 외부에서 호출하지 않기를 권장함.
     * @param {object} data 요청시 사용할 request 파라미터
     */
    readData: function(data) {
        var startNumber = 1,
            grid = this.grid;
        if (!this.isLocked) {
            grid.renderModel.initializeVariables();
            this._lock();

            this.requestedFormData = _.clone(data);
            this.curPage = data.page || this.curPage;
            startNumber = (this.curPage - 1) * this.perPage + 1;
            grid.renderModel.set({
                startNumber: startNumber
            });

            //마지막 요청한 reloadData에서 사용하기 위해 data 를 저장함.
            this.lastRequestedReadData = _.clone(data);
            grid.dataModel.fetch({
                requestType: 'readData',
                data: data,
                type: 'POST',
                success: $.proxy(this._onReadSuccess, this),
                error: $.proxy(this._onReadError, this),
                reset: true
            });
            grid.dataModel.setSortOptionValues(data.sortColumn, data.sortAscending);
        }
    },
    /**
     * sortChanged 이벤트 발생시 실행되는 함수
     * @private
     * @param {object} sortOptions 정렬 옵션
     * @param {string} sortOptions.sortColumn 정렬할 컬럼명
     * @param {boolean} sortOptions.isAscending 오름차순 여부
     */
    _onSortChanged: function(sortOptions) {
        if (sortOptions.isRequireFetch) {
            this._readDataAt(1, true, sortOptions);
        }
    },
    /**
     * 데이터 객체의 정렬 옵션 관련 값을 변경한다.
     * @private
     * @param {object} data 데이터 객체
     * @param {object} sortOptions 정렬 옵션
     * @param {string} sortOptions.sortColumn 정렬할 컬럼명
     * @param {boolean} sortOptions.isAscending 오름차순 여부
     */
    _changeSortOptions: function(data, sortOptions) {
        if (!sortOptions) {
            return;
        }
        if (sortOptions.columnName === 'rowKey') {
            delete data.sortColumn;
            delete data.sortAscending;
        } else {
            data.sortColumn = sortOptions.columnName;
            data.sortAscending = sortOptions.isAscending;
        }
    },

    /**
     * 현재 form data 기준으로, page 에 해당하는 데이터를 조회 한다.
     * @param {Number} page 조회할 페이지 정보
     * @param {Boolean} [isUsingRequestedData=true] page 단위 검색이므로, form 수정여부와 관계없이 처음 보낸 form 데이터로 조회할지 여부를 결정한다.
     * @param {object} sortOptions 정렬 옵션
     * @param {string} sortOptions.sortColumn 정렬할 컬럼명
     * @param {boolean} sortOptions.isAscending 오름차순 여부
     * @private
     */
    _readDataAt: function(page, isUsingRequestedData, sortOptions) {
        var data;

        isUsingRequestedData = isUsingRequestedData === undefined ? true : isUsingRequestedData;
        data = isUsingRequestedData ? this.requestedFormData : this._getFormData();
        data.page = page;
        data.perPage = this.perPage;

        this._changeSortOptions(data, sortOptions);

        if (this.router) {
            this.router.navigate('read/' + util.toQueryString(data), {
                trigger: false
            });
        }
        this.readData(data);
    },

    /**
     * 서버로 API request 한다.
     * @param {String} requestType 요청 타입. 'createData|updateData|deleteData|modifyData' 중 하나를 인자로 넘긴다.
     * @param {object} options Options
     *      @param {String} [options.url]  url 정보. 생략시 Net 에 설정된 api 옵션 정보로 요청한다.
     *      @param {String} [options.hasDataParam=true] rowList 데이터 파라미터를 포함하여 보낼지 여부
     *      @param {String} [options.isOnlyChecked=true]  선택(Check)된 row 에 대한 목록 데이터를 포함하여 요청한다.
     *      isOnlyModified 도 설정되었을 경우, 선택&변경된 목록을 요청한다.
     *      @param {String} [options.isOnlyModified=true]  수정된 행 데이터 목록을 간추려 요청한다.
     *      isOnlyChecked 도 설정되었을 경우, 선택&변경된 목록을 요청한다.
     *      @param {String} [options.isSkipConfirm=false]  confirm 메세지를 보여줄지 여부를 지정한다.
     */
    request: function(requestType, options) {
        var defaultOptions = {
                url: this.options.api[requestType],
                type: null,
                hasDataParam: true,
                isOnlyChecked: true,
                isOnlyModified: true,
                isSkipConfirm: false
            },
            newOptions = $.extend(defaultOptions, options),
            param = this._getRequestParam(requestType, newOptions);

        if (param) {
            this._ajax(param);
        }
    },

    /**
     * 서버로 요청시 사용될 파라미터 중 Grid 의 데이터에 해당하는 데이터를 Option 에 맞추어 반환한다.
     * @param {String} requestType  요청 타입. 'createData|updateData|deleteData|modifyData' 중 하나를 인자로 넘긴다.
     * @param {Object} [options] Options
     *      @param {boolean} [options.hasDataParam=true] request 데이터에 rowList 관련 데이터가 포함될 지 여부.
     *      @param {boolean} [options.isOnlyModified=true] rowList 관련 데이터 중 수정된 데이터만 포함할 지 여부
     *      @param {boolean} [options.isOnlyChecked=true] rowList 관련 데이터 중 checked 된 데이터만 포함할 지 여부
     * @return {{count: number, data: {requestType: string, url: string, data: object, type: string, dataType: string}}}
     * 옵션 조건에 해당하는 그리드 데이터 정보
     * @private
     */
    _getDataParam: function(requestType, options) {
        var dataModel = this.grid.dataModel,
            checkMap = {
                createData: ['createList'],
                updateData: ['updateList'],
                deleteData: ['deleteList'],
                modifyData: ['createList', 'updateList', 'deleteList']
            },
            checkList = checkMap[requestType],
            data = $.extend({}, this.requestedFormData),
            count = 0,
            dataMap;

        options = _.defaults(options || {}, {
            hasDataParam: true,
            isOnlyModified: true,
            isOnlyChecked: true
        });

        if (options.hasDataParam) {
            if (options.isOnlyModified) {
                //{createList: [], updateList:[], deleteList: []} 에 담는다.
                dataMap = dataModel.getModifiedRowList({
                    isOnlyChecked: options.isOnlyChecked
                });
                _.each(dataMap, function(list, name) {
                    if (_.contains(checkList, name) && list.length) {
                        count += list.length;
                        data[name] = $.toJSON(list);
                    }
                }, this);
            } else {
                //{rowList: []} 에 담는다.
                data.rowList = dataModel.getRowList(options.isOnlyChecked);
                count = data.rowList.length;
            }
        }

        return {
            data: data,
            count: count
        };
    },

    /**
     * requestType 에 따라 서버에 요청할 파라미터를 반환한다.
     * @param {String} requestType 요청 타입. 'createData|updateData|deleteData|modifyData' 중 하나를 인자로 넘긴다.
     * @param {Object} [options] Options
     *      @param {String} [options.url=this.options.api[requestType]] 요청할 url.
     *      지정하지 않을 시 option 으로 넘긴 API 중 request Type 에 해당하는 url 로 지정됨
     *      @param {String} [options.type='POST'] request method 타입
     *      @param {boolean} [options.hasDataParam=true] request 데이터에 rowList 관련 데이터가 포함될 지 여부.
     *      @param {boolean} [options.isOnlyModified=true] rowList 관련 데이터 중 수정된 데이터만 포함할 지 여부
     *      @param {boolean} [options.isOnlyChecked=true] rowList 관련 데이터 중 checked 된 데이터만 포함할 지 여부
     * @return {{requestType: string, url: string, data: object, type: string, dataType: string}} ajax 호출시 사용될 option 파라미터
     * @private
     */
    _getRequestParam: function(requestType, options) {
        var defaultOptions = {
                url: this.options.api[requestType],
                type: null,
                hasDataParam: true,
                isOnlyModified: true,
                isOnlyChecked: true
            },
            newOptions = $.extend(defaultOptions, options),
            dataParam = this._getDataParam(requestType, newOptions),
            param;

        if (newOptions.isSkipConfirm || this._isConfirmed(requestType, dataParam.count)) {
            param = {
                requestType: requestType,
                url: newOptions.url,
                data: dataParam.data,
                type: newOptions.type
            };
            return param;
        }
    },

    /**
     * requestType 에 따른 컨펌 메세지를 노출한다.
     * @param {String} requestType 요청 타입. 'createData|updateData|deleteData|modifyData' 중 하나를 인자로 넘긴다.
     * @param {Number} count   전송될 데이터 개수
     * @return {boolean}    계속 진행할지 여부를 반환한다.
     * @private
     */
    _isConfirmed: function(requestType, count) {
        var result = false;

        /* istanbul ignore next: confirm 을 확인할 수 없읔 */
        if (count > 0) {
            result = confirm(this._getConfirmMessage(requestType, count));
        } else {
            alert(this._getConfirmMessage(requestType, count));
        }
        return result;
    },

    /**
     * confirm message 를 반환한다.
     * @param {String} requestType 요청 타입. 'createData|updateData|deleteData|modifyData' 중 하나를 인자로 넘긴다.
     * @param {Number} count 전송될 데이터 개수
     * @return {string} 생성된 confirm 메세지
     * @private
     */
    _getConfirmMessage: function(requestType, count) {
        var textMap = {
                'createData': '입력',
                'updateData': '수정',
                'deleteData': '삭제',
                'modifyData': '반영'
            },
            actionName = textMap[requestType],
            message;

        if (count > 0) {
            message = count + '건의 데이터를 ' + actionName + '하시겠습니까?';
        } else {
            message = actionName + '할 데이터가 없습니다.';
        }
        return message;
    },

    /**
     * ajax 통신을 한다.
     * @param {{requestType: string, url: string, data: object, type: string, dataType: string}} options ajax 요청 파라미터
     * @private
     */
    _ajax: function(options) {
        var eventData = this.createEventData(options.data),
            params;

        //beforeRequest 이벤트를 발생한다.
        this.grid.trigger('beforeRequest', eventData);

        //event의 stopped 가 호출 된다면 ajax 호출을 중지한다.
        if (eventData.isStopped()) {
            return;
        }

        options = $.extend({requestType: ''}, options);
        params = {
            url: options.url,
            data: options.data || {},
            type: options.type || 'POST',
            dataType: options.dataType || 'json',
            complete: $.proxy(this._onComplete, this, options.complete, options),
            success: $.proxy(this._onSuccess, this, options.success, options),
            error: $.proxy(this._onError, this, options.error, options)
        };
        if (options.url) {
            $.ajax(params);
        }
    },

    /**
     * ajax complete 이벤트 핸들러
     * @param {Function} callback   통신 완료 이후 수행할 콜백함수
     * @param {object} jqXHR    jqueryXHR  객체
     * @param {number} status   http status 정보
     * @private
     */
    _onComplete: function(callback, jqXHR, status) { // eslint-disable-line no-unused-vars
        this._unlock();
    },

    /**
     * ajax success 이벤트 핸들러
     * @param {Function} callback Callback function
     * @param {{requestType: string, url: string, data: object, type: string, dataType: string}} options ajax 요청 파라미터
     * @param {Object} responseData 응답 데이터
     * @param {number} status   http status 정보
     * @param {object} jqXHR    jqueryXHR  객체
     * @private
     */
    _onSuccess: function(callback, options, responseData, status, jqXHR) {
        var message = responseData && responseData['message'],
            eventData = this.createEventData({
                httpStatus: status,
                requestType: options.requestType,
                requestParameter: options.data,
                responseData: responseData
            });
        this.grid.trigger('response', eventData);
        if (eventData.isStopped()) {
            return;
        }
        if (responseData && responseData['result']) {
            this.grid.trigger('successResponse', eventData);
            if (eventData.isStopped()) {
                return;
            }
            if (_.isFunction(callback)) {
                callback(responseData['data'] || {}, status, jqXHR);
            }
        } else {
            // TODO: 오류 처리 - invalid 셀에 마크하기 등. 스펙아웃 할 수도 있음
            this.grid.trigger('failResponse', eventData);
            if (eventData.isStopped()) {
                return;
            }
            if (message) {
                alert(message);
            }
        }
    },

    /**
     * ajax error 이벤트 핸들러
     * @param {Function} callback Callback function
     * @param {{requestType: string, url: string, data: object, type: string, dataType: string}} options ajax 요청 파라미터
     * @param {object} jqXHR    jqueryXHR  객체
     * @param {number} status   http status 정보
     * @param {String} errorMessage 에러 메세지
     * @private
     */
    _onError: function(callback, options, jqXHR, status) {
        var eventData = this.createEventData({
            httpStatus: status,
            requestType: options.requestType,
            requestParameter: options.data,
            responseData: null
        });
        this.grid.hideGridLayer();

        this.grid.trigger('response', eventData);
        if (eventData.isStopped()) {
            return;
        }

        this.grid.trigger('errorResponse', eventData);
        if (eventData.isStopped()) {
            return;
        }

        if (jqXHR.readyState > 1) {
            alert('데이터 요청 중에 에러가 발생하였습니다.\n\n다시 시도하여 주시기 바랍니다.');
        }
    }
});

module.exports = Net;