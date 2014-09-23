/*
 * Copyright(c) 2014, Unional (https://github.com/unional)
 * @license Licensed under the MIT License (https://github.com/unional/unional/LICENSE)).
 * @version 0.3.6
 * Created by unional on 9/21/14.
 */
//noinspection ThisExpressionReferencesGlobalObjectJS
(function(root) {
    "use strict";

    /**
     * Universal module definition method. Use this method to simplify module definition.
     * To use this method, write your module as follow:
     * <pre><code>
     *     umd(function(define) {
      *         define(function(require, exports, module) {
      *             // Your code here
      *         });
      *    }, "MyCompany.MyProduct.MySection.MyComponentName", require, exports, module);
     * </code></pre>
     * Notice the last three parameters are require, exports and module. Keep them as is.
     * They are used to round tripped back to your code for node.js.
     *
     * For require.js, load this umd module before other modules
     * (at common/main.js where you write require.config({...}))
     * For r.js, you can use onBuildRead to trim out the umd code, just leaving the define call in-place.
     *
     * This is tested for browser global and require.js.
     * It does not work for node.js yet because the module object in this scope is different than in the actual module
     * @param factory
     * @param {string|null} browserGlobalIdentifier Identifier for browser global. Pass in falsy value to omit browser global definition.
     * @param require Round trip require function (pre-defined)
     * @param exports Round trip exports object (pre-defined)
     * @param module Round trip module object (pre-defined)
     */
    var umd = function(factory, browserGlobalIdentifier, require, exports, module) {
        if (umd.isRequireJS()) {
            factory(define);
        }
        else if (umd.isNodeJS()) {
            // Node (not CommonJS because module.exports does not conform)
            factory(function(definition) {
                //noinspection JSUnresolvedVariable
                var result = definition(require, exports, module);
                if (typeof result !== "undefined") {
                    //noinspection JSUnresolvedVariable
                    module.exports = result;
                }
            });
        }
        else {
            // browser global.
            factory(function(definition) {
                // umd assigns window.module and window.exports to undefined,
                // which passed in by the module definition to this method.
                // Assign it locally to mimic their functionality.
                module = {exports: {}};
                var result = definition(umd.require, module.exports, module);

                if (browserGlobalIdentifier) {
                    var terms = browserGlobalIdentifier.split(/[.\/]/);
                    var id = terms.pop();
                    var base = umd.ns(terms.join("."));
                    base[id] = (typeof result !== 'undefined') ? result : module.exports;
                }
            });
        }
    };

    /**
     * Creates namespaces to be used for scoping variables and classes so that they are not global.
     * Specifying the last node of a namespace implicitly creates all other nodes.
     * Similar to Ext.ns() without the dependency.
     * @param {...string} namespace
     * @return {Object} The namespace object. (If multiple arguments are passed, this will be the last namespace created)
     * @method namespace
     */
    umd.namespace = function namespace(namespace) {
        var result;
        for (var i = 0, len = arguments.length; i < len; i++) {
            namespace = arguments[i];
            var components = namespace.split(/[.\/]/);

            var component = components.shift();
            result = root[component] = root[component] || {};

            while (components.length) {
                component = components.shift();
                result = result[component] = result[component] || {};
            }
        }

        return result;
    };

    umd.ns = umd.namespace;

    umd.isRequireJS = function isRequireJS() {
        return typeof define === "function" && define.amd;
    };
    /**
     * Determine whether the environment is node.js
     * Technically this is also true for CommonJS but I named it as NodeJS because
     * I don't fully support CommonJS yet.
     * @returns {boolean}
     */
    umd.isNodeJS = function isNodeJS() {
        return typeof require === "function" &&
               typeof exports === 'object' &&
               typeof module === 'object';
    };

    umd.isBrowserGlobal = function isBrowserGlobal() {
        return !umd.isRequireJS() && !umd.isNodeJS();
    };

    var contexts = {
        "default": newContext({})
    };

    umd.require = contexts.default.require;

    /**
     * Config require similar to requireJS.
     * @param {object} option Config option.
     * @param {string} [option.context] Context name. If not specified, it modifies the default context.
     * @param {object} [option.map] Map shorthands.
     * @returns {*}
     */
    umd.require.config = function(option) {
        if (option.context) {
            return contexts[option.context] = contexts[option.context] || newContext(option);
        }
        else {
            contexts.default.updateOption(option);
            return contexts.default.require;
        }
    };

    var contextCount = 0;

    /**
     * Requiring dependencies while injects specified stubs.
     * @param {[]} deps Dependencies
     * @param {object} stubs Stubs `{ "moduleA": stubA }`
     * @param {function} callback The callback function.
     * @param {function} [errback] The error back function.
     * @returns {Function|*}
     */
    umd.stubRequire = function(deps, stubs, callback, errback) {
        if (!Array.isArray(deps)) {
            throw new Error("Dependencies must be an array.");
        }

        var require = umd.globalRequire;
        if (require.defined) {
            // require.js
            contextCount++;
            var map = {};

            for (var key in stubs) {
                if (stubs.hasOwnProperty(key)) {
                    var stubName = 'stub' + key + contextCount;
                    map[key] = stubName;
                    (function(key) {
                        var value = stubs[key];
                        define(stubName, [], function() {
                            return value;
                        });
                    }(key))
                }
            }

            var contextName = "context_" + contextCount;
            var result = require.config({
                context: contextName,
                map: {
                    "*": map
                },
                baseUrl: require.s.contexts._.config.baseUrl,
                paths: require.s.contexts._.config.paths
            });

            var parentDefined = require.s.contexts._.defined;
            for (var m in parentDefined) {
                if (parentDefined.hasOwnProperty(m) && !map[m] && deps.indexOf(m) === -1) {
                    require.s.contexts[contextName].defined[m] = parentDefined[m];
                }
            }

            result(deps, callback, errback);
        }
        else if (require === umd.require) {
            // browser global
            contextCount++;
            var stubContext = 'stub' + contextCount;
            var context = contexts[stubContext] = newContext({
                stubs: stubs
            });

            // Browser global does not need errback as everything are already loaded.
            context.require(deps, callback);
        }
        else {
            // node
            throw new Error("stubRequire not implemented for node.js yet.");
        }
    };

    if (typeof require === "function") {
        // node
        umd.globalRequire = require;
    }
    else {
        umd.globalRequire = root.require;
    }

    /**
     * Create new context.
     * @param option
     * @returns {{updateOption: Function, require: Function}}
     */
    function newContext(option) {
        return {
            updateOption: function updateOption(newOption) {
                option = newOption;
            },
            /**
             * A simple stub for requireJS and commonJS require function.
             * This is use to support universal module definition (umd) for browser globals code.
             * @param {string|string[]} moduleName Name of the module.
             * @param {function} [callback] Function to call after resolving the module.
             * @returns {*} The target module if found; otherwise, undefined.
             */
            require: function require(moduleName, callback) {
                if (!moduleName) {
                    throw new Error("moduleName can't be empty");
                }

                if (Array.isArray(moduleName)) {
                    var modules = moduleName.map(function(item) {
                        return resolveModule(item);
                    });

                    if (modules && callback) {
                        callback.apply(this, modules);
                    }
                }
                else {
                    var module = resolveModule(moduleName);

                    if (module && callback) {
                        callback(module);
                    }

                    return module;
                }

                function resolveModule(moduleName) {
                    var parts = moduleName.split('!', 2);
                    var arg = undefined;
                    if (parts.length == 2) {
                        moduleName = parts[0];
                        if (parts[1]) {
                            arg = parts[1];
                        }
                    }

                    var names = moduleName.split(/[.\/]/);
                    var name = names.shift();

                    var stubs = option.stubs || {};
                    var module = stubs[name] || root[name];
                    while (module && names.length) {
                        name = names.shift();
                        module = module[name];
                    }

                    if (parts.length == 2) {
                        module = module(arg);
                    }

                    return module;
                }
            }
        };
    }

    //noinspection JSUnresolvedVariable
    if (typeof global !== 'undefined') {
        // Node js
        //noinspection JSUnresolvedVariable
        global.umd = umd;
        module.exports = umd;
    }
    else {
        root.umd = umd;
        // define require, exports, and module so that they won't cause
        // ReferenceError in the module for browser global scenario.
        root.require = root.require || undefined;
        root.module = root.module || undefined;
        root.exports = root.exports || undefined;
    }
}(this));