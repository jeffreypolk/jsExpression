
(function ($) {

    var _tests = {
        allValidKeys: new RegExp("^[()+-//*0-9\.=]+$"),
        operator: new RegExp("^[+-//*]+$"),
        value: new RegExp("^[0-9\.=]+$"),
        parens: new RegExp("^[()]+$"),
        functions: new RegExp("^=$")
    }
    var _optionsStoreName = 'options-store';

    var _getOptions = function (elem) {
        if (elem.hasClass('jsb-exp')) {
            return elem.data(_optionsStoreName); 
        } else {
            return elem.closest('.jsb-exp').data(_optionsStoreName);
        }
    }

    var _setOptions = function (elem, options) {
        elem.data(_optionsStoreName, options);
    }

    var _hideLists = function (elem) {
        // hide all lists
        elem.closest('.jsb-exp').find('.list').hide();
    }

    var _buildFunctionEditor = function (options) {
        var html = [];
        html.push('<div class="list function-editor">');
        html.push('<div><h4 class="name"></h4></div>');
        html.push('<div class="description"></div>');
        html.push('<hr>');
        html.push('<div class="alert alert-danger"></div>');
        html.push('<div class="canvas"></div>');
        html.push('<hr>');
        html.push('<div class="actions">');
        html.push('<a class="editor-update" href="#">Update</a>&nbsp;|&nbsp;');
        html.push('<a class="editor-functions" href="#">Functions</a>&nbsp;|&nbsp;');
        html.push('<a class="editor-cancel" href="#">Cancel</a>');
        html.push('</div></div>');
        return html.join('');
    }

    var _buildFunctionHelper =  function (options) {
        var ret = {};

        // field selector html
        ret.getFieldSelectorHtml = function (selectedId, cls) {
            var html = [];
            html.push('<div><select class="form-control field-selector ', cls ? cls : '', '">');
            $.each(options.fields, function (index, item) {
                if (selectedId === item.id) {
                    html.push('<option selected="selected" value="', item.id, '">', item.name, '</option>');
                } else {
                    html.push('<option value="', item.id, '">', item.name, '</option>');
                }
            });
            html.push('</select></div>');
            return html.join('');
        }
        
        // get selected field value
        ret.getSelectedFieldId = function () {
            //debugger;
            var id = options.functionEditor.find('.field-selector').val();
            return id;
        }

        // get selected field object
        ret.getSelectedField = function (container) {
            var id = ret.getSelectedFieldId();
            return _getFieldById(options, id);
        }

        // get fields
        ret.getFields = function () {
            return options.fields;
        } 

        // get field
        ret.getFieldById = function (fieldId) {
            return _getFieldById(options, fieldId);
        } 

        // set error message
        ret.error = function(message) {
            options.functionEditor.find('.alert-danger').html(message).fadeIn();
        }

        return ret;    
    }

    var _init = function (elem, options) {

        // remove all existing content
        elem.empty();

        var html = [];
        options.container = elem;
        options.functionHelper = _buildFunctionHelper(options);
        options.tabIndex = $.fn.jsb.util.getId() + 500;
        html.push(_buildFunctionEditor(options));

        // we need to make refs to fns and go back through them after the DOM is updated
        var fnArr = [];

        if (options.expression && options.expression.tokens && options.expression.tokens.length > 0) {
            $.each(options.expression.tokens, function (index, item) {
                var id = $.fn.jsb.util.getIdString();
                options.tabIndex += 1;
                if (item.type === 'literal') {
                    html.push('<div class="token" id="', id, '" tabindex="', options.tabIndex, '" data-type="literal">', item.value, '</div>');
                } else if (item.type === 'field') {
                    html.push('<div class="token" id="', id, '" tabindex="', options.tabIndex, '" data-type="field" data-fieldid="', item.fieldId, '">', item.value, '</div>');
                } else if (item.type === 'fn') {
                    var fn = _getFunctionByName(item.name);
                    fnArr.push({
                        id: id,
                        fn: fn,
                        data: item.data
                    })
                    html.push('<div class="token" id="', id, '" tabindex="', options.tabIndex, '" data-type="fn" data-name="', item.name, '"></div>');
                }
                
            });
        } else {
            html.push('<div class="token" tabindex="', options.tabIndex, '"></div>');
        }
        elem.addClass('jsb-exp');
        $(html.join('')).appendTo(elem);

        // now that everything is in the dom, attach/render functions
        $.each(fnArr, function (index, item) {
            var elem = $('#' + item.id);
            // add data
            elem.data('functiondata', item.data);
            // render
            item.fn.render(elem, options.functionHelper, item.data);
        });
        //console.log(fnArr);

        _applyHandlers(elem, options);
        options.functionEditor = options.container.find('.function-editor');
        elem.find('div.token').first().focus();
    }

    var _applyHandlers = function (elem, options) {

        // handler for all keystrokes in token divs
        elem.on('keydown', '.token', function (event) {
            var elem = $(this);
            var key = _normalizeKey(event);
            _keyDown(elem, options, event, key);
        });

        // handler for clicking on token divs
        elem.on('click', '.token', function (event) {
            var elem = $(this);
            if (elem.data('type') === 'fn') {
                var options = _getOptions(elem)
                var fn = _getFunctionByName(elem.data('name'));
                if (fn.edit) {
                    _showFunctionEditor(elem, fn, options);
                } else {
                    _showFunctionList(elem, options);
                }
            } else if (elem.data('type') === 'field') {
                var options = _getOptions(elem);
                _showFunctionList(elem, options);
            }
        });

        // handler for clicking on fields/functions
        elem.on('click', '.function-list .item', function (event) {
            _selectFieldOrFunction($(this), options);
        });

        // handler for updating function editor
        elem.on('click', '.editor-update', function (event) {
            var options = _getOptions(elem);
            _updateFunction(options);
        });

        // handler for exiting function and showing chooser
        elem.on('click', '.editor-functions', function (event) {
            var options = _getOptions(elem);
            _closeFunctionEditor(options);
            _showFunctionList(options.functionEditor.data('initiator'), options);
        });

        // handler for canceling function editor
        elem.on('click', '.editor-cancel', function (event) {
            var options = _getOptions(elem);
            _cancelFunctionEditor(options);
        });

    }

    var _normalizeKey = function (event) {

        var key;
        var keyCode = event.keyCode || event.which;
        if (keyCode === 9) {
            // tab
            if (event.shiftKey) {
                key = 'PREV';
            } else {
                key = 'NEXT';
            }
        } else if (keyCode === 37) {
            // left arrow
            key = 'PREV';
        } else if (keyCode === 39 || keyCode === 13) {
            // right arrow, enter
            key = 'NEXT';
        } else {
            key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
            //console.log(event.which);
            switch (keyCode) {
                case 8:
                    key = 'DEL';
                    break;
                case 191:
                    key = '/';
                    break;
                case 189:
                    key = '-';
                    break;
                case 187:
                    key = '='
                    if (event.shiftKey)
                        key = '+';
                    break;
                case 56:
                    if (event.shiftKey)
                        key = '*';
                    break;
                case 190:
                    key = '.';
                    break;
                case 168:
                    key = '(';
                    break;
                case 169:
                    key = ')';
                    break;
                case 57:
                    if (event.shiftKey)
                        key = '(';
                    break;
                case 48:
                    if (event.shiftKey)
                        key = ')';
                    break;
                case 116:
                    key = 'REFRESH';
                    break;
                case 96:
                    key = '0';
                    break;
                case 97:
                    key = '1';
                    break;
                case 98:
                    key = '2';
                    break;
                case 99:
                    key = '3';
                    break;
                case 100:
                    key = '4';
                    break;
                case 101:
                    key = '5';
                    break;
                case 102:
                    key = '6';
                    break;
                case 103:
                    key = '7';
                    break;
                case 104:
                    key = '8';
                    break;
                case 105:
                    key = '9';
                    break;
                case 106:
                    key = '*';
                    break;
                case 107:
                    key = '+';
                    break;
                case 109:
                    key = '-';
                    break;
                case 110:
                    key = '.';
                    break;
                case 111:
                    key = '/';
                    break;
            }
        }
        return key;
    }

    var _next = function (elem, options) {
        //elem.next().attr('readonly', false).select();
        if (elem.next().length === 0) {
            // create new div
            var tabIndex = parseInt(elem.attr('tabindex')) + 1;
            //var className = elem.hasClass('operator') ? 'value' : 'operator';
            $('<div class="token" tabindex="' + tabIndex + '"></div>').appendTo(elem.parent());
        }
        return elem.next().focus();
    }

    var _prev = function (elem, options) {
        //elem.next().attr('readonly', false).select();
        return elem.prev().focus();
    }

    var _triggerChange = function (options) {
        if ($.isFunction(options.onChange)) {
            options.onChange.call(options.container);
        }
    }

    var _keyDown = function (elem, options, event, key) {
        if (key === 'REFRESH') {
            window.location.href = window.location.href;
            return;
        }

        _hideLists(elem);

        if (key === 'PREV' || key === 'NEXT') {
            // this is navigation
            event.preventDefault();
            if (key === 'PREV') {
                _prev(elem);
            } else {
                _next(elem);
            }
            return;
        }

        if (key === 'DEL') {
            // is the element already empty?
            if (!elem.html()) {
                _keyDown(_prev(elem, options), options, event, 'DEL');
                elem.remove();
                return;
            } else {
                // delete key...empty element
                elem.empty();
                elem.data('type', null);
            }
            
            // change event
            _triggerChange(options);

        } else {
            // validate key and quit if bad
            if (!_tests.allValidKeys.test(key)) {
                // bad
                event.preventDefault();
                return;
            }
            // get the previous key to know what's allowed
            var prevKey;
            if (elem.prev().length > 0) {
                prevKey = elem.prev().html();
            }
            var existingValue = elem.html();
            if (!existingValue && _tests.operator.test(prevKey) && _tests.operator.test(key)) {
                // cant have two operators together
                // dont do this check unless the existing div is empty
                event.preventDefault();
                return;
            } else if (_tests.value.test(prevKey) && _tests.value.test(key)) {
                // cant have two values together
                event.preventDefault();
                return;
            }
            
            if (_tests.functions.test(key)) {
                // open functions
                event.preventDefault();
                _showFunctionList(elem, options);
                return;
            } else {
                if (_tests.value.test(elem.html()) && (_tests.operator.test(key) || _tests.parens.test(key))) {
                    // we're in value, but entered operator/paren
                    // move to the next div and set it with this key
                    var next = _next(elem, options);
                    _keyDown(next, options, event, key);
                    return;
                }
                //div - update content
                if (_tests.operator.test(elem.html())) {
                    // replace
                    elem.html(key);
                } else {
                    // append
                    elem.html(elem.html() + key);
                }

                // auto-advance?
                if (_tests.operator.test(elem.html()) || key === '(' || key === ')') {
                    _next(elem, options);
                }

                // change event
                _triggerChange(options);
            }
        }
    }

    var _showFunctionList = function (elem, options) {
        //debugger;
        if (options.container.find('.function-list').length === 0) {
            var html = [];
            // build a helper function for rendering functions
            var addFunctions = function (type) {
                html.push('<div class="category">', type, 's</div>');
                $.each($.fn.jsbExp.functions, function (index, item) {
                    if (item.type === type.toLowerCase()) {
                        html.push('<div><span class="item" data-type="function" data-name="', item.name, '" title="', item.description, '">', item.name, '</span></div>');
                    }
                });
            }
            html.push('<div class="list function-list">');
            html.push('<div class="category">Fields</div>');
            $.each(options.fields, function (index, field) {
                html.push('<div><span class="item" data-type="field" data-fieldid="', field.id, '">', field.name, '</span></div>');
            });
            // add functions by type
            addFunctions('String');
            addFunctions('Numeric');
            addFunctions('Date');

            html.push('</div>');
            $(html.join('')).prependTo(options.container);
        }
        // show the list
        options.container.find('.function-list').data('initiator', elem).css({ 'top': elem.position().top + elem.height() + 10, 'left': elem.position().left }).fadeIn();
    }

    var _showFunctionEditor = function (elem, fn, options) {
        //debugger;
        var editor = options.container.find('.function-editor');
        editor.find('.name').html(fn.name);
        editor.find('.description').html(fn.description);
        editor.data('fn', fn);
        editor.data('initiator', elem)
        var canvas = editor.find('.canvas');
        canvas.empty();
        var data = elem.data('functiondata') ? elem.data('functiondata') : {};
        fn.edit(canvas, options.functionHelper, data);
        // show the list
        editor.css({'top':elem.position().top + elem.height() + 10, 'left':elem.position().left}).fadeIn();
    }

    var _closeFunctionEditor = function (options) {
        options.functionEditor.hide();
        options.functionEditor.find('.alert-danger').hide();
        options.functionEditor.data('fn', null);
        options.functionEditor.find('.canvas').empty();
    }

    var _cancelFunctionEditor = function (options) {
        _closeFunctionEditor(options)
        // focus initiator
        options.functionEditor.data('initiator').focus();
    }

    var _updateFunction = function (options) {
        var editor = options.functionEditor;
        var fn = editor.data('fn');
        var initiator = editor.data('initiator'); 
        var helper = options.functionHelper;
        var data = initiator.data('functiondata') ? initiator.data('functiondata') : {};
        if (fn.update(editor.find('.canvas'), helper, data)) {
            initiator.data('type', 'fn');
            initiator.data('name', fn.name);
            initiator.data('functiondata', data);
            initiator.empty();
            fn.render(initiator, helper, data);
            _closeFunctionEditor(options);
            initiator.focus();
            // change event
            _triggerChange(options);
        }
    }
    
    var _selectFieldOrFunction = function (elem, options) {
        _hideLists(elem);
        var initiator = elem.closest('.function-list').data('initiator');
        if (elem.data('type') === 'field') {
            var field = _getFieldById(options, elem.data('fieldid'));
            initiator.data('type', 'field');
            initiator.data('fieldid', field.id);
            initiator.html(field.name);
            _triggerChange(options);
        } else {
            // this is a function
            var fn = _getFunctionByName(elem.data('name'));
            if (fn.edit) {
                _showFunctionEditor(initiator, fn, options);
            } else {
                // there is no editor
                initiator.data('type', 'fn');
                initiator.data('name', fn.name);
                initiator.empty();
                fn.render(initiator, options.functionHelper, {});
                _closeFunctionEditor(options);
                initiator.focus();
                // change event
                _triggerChange(options);
            }
            
        }
    }

    var _getFieldById = function (options, fieldId) {
        //debugger;
        var field = {};
        $.each(options.fields, function(index, item) {
            if (item.id === fieldId) {
                field = item;
                return false;
            }
        });
        return field;
    }

    var _getFunctionByName = function (name) {
        //debugger;
        var fn = {};
        $.each($.fn.jsbExp.functions, function(index, item) {
            if (item.name === name) {
                fn = item;
                return false;
            }
        });
        return fn;
    }

    

    var methods = {

        init: function (options) {

            // Establish our default settings
            var opt = $.extend({
                fields: [],
                expression: {},
                    /*
                    tokens:[{  
                        type: 'literal',
                        value: '1'
                    }, {
                        type: 'literal',
                        value: '+'
                    }, {
                        type: 'field',
                        fieldId: 'AccountNumber',
                        value: 'Account Number'
                    }, {
                        type: 'literal',
                        value: '+'
                    }, {
                        type: 'fn',
                        name: 'Left',
                        data: {
                            fieldId: 'AccountNumber',
                            numChars: 3
                        }
                    }],
                    formula: 'function () {}', 
                    text: '1 + model.AccountNummber + Left(Account Number, 3)'
                    },

                */  
                onChange: null
            }, options);

            //console.log(opt.fields)
            return this.each(function () {

                // get ref
                var $this = $(this);

                // store the settings on the element
                _setOptions($this, opt);

                // do stuff
                _init($this, opt);
            });

        },

        getExpression: function (modelName) {
            var options = _getOptions($(this));
            var tokens = [];
            var formula = [];
            var text = [];

            $.each($(this).find('.token'), function (index, item) {
                //debugger;
                var elem = $(item);


                if (tokens.length === 0) {
                    formula.push('(');
                    text.push('(');
                } else {
                    formula.push(' ');
                    text.push(' ');
                }


                if (elem.data('type') === 'field') {
                    // this is a field
                    var field = _getFieldById(options, elem.data('fieldid'));
                    tokens.push({
                        type: 'field',
                        fieldId: elem.data('fieldid'),
                        value: elem.text()
                    });
                    formula.push(modelName + '.' + field.id);
                    

                } else if (elem.data('type') === 'fn') {
                    // this is a fuction
                    var fn = _getFunctionByName(elem.data('name'));
                    tokens.push({
                        type: 'fn',
                        name: fn.name,
                        data: elem.data('functiondata')
                    });
                    formula.push('function(){', fn.toFunction(modelName, options.functionHelper, elem.data('functiondata')), '}()');

                } else {
                    // straight literal
                    tokens.push({
                        type: 'literal',
                        value: elem.text()
                    });
                    formula.push($(elem).text())
                }

                // add to english text
                text.push(elem.text());

            });
            formula.push(')');
            text.push(')');

            return {
                tokens: tokens,
                formula: formula.join(''),
                text: text.join('')
            };;
        }
    };

    $.fn.jsbExp = function (methodOrOptions) {

        if (methods[methodOrOptions]) {
            return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
            // Default to "init"
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + methodOrOptions + ' does not exist on jQuery.plugin');
        }
    }

    // define functions in exp.functions.js
    // custom functions can be added by adding to this array by the client
    $.fn.jsbExp.functions = [];

    $.fn.jsbExp.build = function (data) {

        var formula = [];
        var text = [];

        var findField = function(fieldId) {
            var field = {};
            $.each(data.fields, function(index, item) {
                if (item.id === fieldId) {
                    field = item;
                    return false;
                }
            });
            return field;
        }
        var findFunction = function (name) {
            var fn = {};
            $.each($.fn.jsbExp.functions, function(index, item) {
                if (item.name === name) {
                    fn = item;
                    return false;
                }
            });
            return fn;
        }
        // TODO - if a function needs this, it's not completely there!
        var functionHelper = {
            getFieldById: findField
        };

        $.each(data.tokens, function (index, token) {
            
            if (formula.length === 0) {
                formula.push('(');
                text.push('(');
            } else {
                formula.push(' ');
                text.push(' ');
            }

            if (token.type === 'field') {
                // this is a field
                var field = findField(token.fieldId);
                formula.push(data.modelName + '.' + field.id);
                text.push(field.name);

            } else if (token.type === 'fn') {
                // this is a fuction
                var fn = findFunction(token.name);
                formula.push('function(){', fn.toFunction(data.modelName, functionHelper, token.data), '}()');
                var tempElem = $('<div></div>');
                text.push(fn.render(tempElem, functionHelper, token.data));
            } else {
                // straight literal
                formula.push(token.value);
                text.push(token.value);
            }

        });
        formula.push(')');
        text.push(')');

        return {
            formula: formula.join(''),
            text: text.join('')
        };;
    }

}(jQuery));
