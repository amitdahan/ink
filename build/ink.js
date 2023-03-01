import process from 'node:process';
import React from 'react';
import { throttle } from 'lodash-es';
import ansiEscapes from 'ansi-escapes';
import originalIsCi from 'is-ci';
import autoBind from 'auto-bind';
import signalExit from 'signal-exit';
import patchConsole from 'patch-console';
import reconciler from './reconciler.js';
import render from './renderer.js';
import * as dom from './dom.js';
import logUpdate from './log-update.js';
import instances from './instances.js';
import App from './components/App.js';
const isCi = process.env['CI'] === 'false' ? false : originalIsCi;
const noop = () => { };
export default class Ink {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "log", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "throttledLog", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Ignore last render after unmounting a tree to prevent empty output before exit
        Object.defineProperty(this, "isUnmounted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastOutput", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rootNode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // This variable is used only in debug mode to store full static output
        // so that it's rerendered every time, not just new static parts, like in non-debug mode
        Object.defineProperty(this, "fullStaticOutput", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "exitPromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "restoreConsole", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "unsubscribeResize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "resolveExitPromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { }
        });
        Object.defineProperty(this, "rejectExitPromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { }
        });
        Object.defineProperty(this, "unsubscribeExit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => { }
        });
        Object.defineProperty(this, "onRender", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (this.isUnmounted) {
                    return;
                }
                const { output, outputHeight, staticOutput } = render(this.rootNode, 
                // The 'columns' property can be undefined or 0 when not using a TTY.
                // In that case we fall back to 80.
                this.options.stdout.columns || 80);
                // If <Static> output isn't empty, it means new children have been added to it
                const hasStaticOutput = staticOutput && staticOutput !== '\n';
                if (this.options.debug) {
                    if (hasStaticOutput) {
                        this.fullStaticOutput += staticOutput;
                    }
                    this.options.stdout.write(this.fullStaticOutput + output);
                    return;
                }
                if (isCi) {
                    if (hasStaticOutput) {
                        this.options.stdout.write(staticOutput);
                    }
                    this.lastOutput = output;
                    return;
                }
                if (hasStaticOutput) {
                    this.fullStaticOutput += staticOutput;
                }
                if (outputHeight >= this.options.stdout.rows) {
                    this.options.stdout.write(ansiEscapes.clearTerminal + this.fullStaticOutput + output);
                    this.lastOutput = output;
                    return;
                }
                // To ensure static output is cleanly rendered before main output, clear main output first
                if (hasStaticOutput) {
                    this.log.clear();
                    this.options.stdout.write(staticOutput);
                    this.log(output);
                }
                if (!hasStaticOutput && output !== this.lastOutput) {
                    this.throttledLog(output);
                }
                this.lastOutput = output;
            }
        });
        autoBind(this);
        this.options = options;
        this.rootNode = dom.createNode('ink-root');
        this.rootNode.onRender = options.debug
            ? this.onRender
            : throttle(this.onRender, 32, {
                leading: true,
                trailing: true
            });
        this.rootNode.onImmediateRender = this.onRender;
        this.log = logUpdate.create(options.stdout);
        this.throttledLog = options.debug
            ? this.log
            : throttle(this.log, undefined, {
                leading: true,
                trailing: true
            });
        // Ignore last render after unmounting a tree to prevent empty output before exit
        this.isUnmounted = false;
        // Store last output to only rerender when needed
        this.lastOutput = '';
        // This variable is used only in debug mode to store full static output
        // so that it's rerendered every time, not just new static parts, like in non-debug mode
        this.fullStaticOutput = '';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.container = reconciler.createContainer(this.rootNode, 
        // Legacy mode
        0, null, false, null, 'id', () => { }, null);
        // Unmount when process exits
        this.unsubscribeExit = signalExit(this.unmount, { alwaysLast: false });
        if (process.env['DEV'] === 'true') {
            reconciler.injectIntoDevTools({
                bundleType: 0,
                // Reporting React DOM's version, not Ink's
                // See https://github.com/facebook/react/issues/16666#issuecomment-532639905
                version: '16.13.1',
                rendererPackageName: 'ink'
            });
        }
        if (options.patchConsole) {
            this.patchConsole();
        }
        if (!isCi) {
            options.stdout.on('resize', this.onRender);
            this.unsubscribeResize = () => {
                options.stdout.off('resize', this.onRender);
            };
        }
    }
    render(node) {
        const tree = (React.createElement(App, { stdin: this.options.stdin, stdout: this.options.stdout, stderr: this.options.stderr, writeToStdout: this.writeToStdout, writeToStderr: this.writeToStderr, exitOnCtrlC: this.options.exitOnCtrlC, onExit: this.unmount }, node));
        reconciler.updateContainer(tree, this.container, null, noop);
    }
    writeToStdout(data) {
        if (this.isUnmounted) {
            return;
        }
        if (this.options.debug) {
            this.options.stdout.write(data + this.fullStaticOutput + this.lastOutput);
            return;
        }
        if (isCi) {
            this.options.stdout.write(data);
            return;
        }
        this.log.clear();
        this.options.stdout.write(data);
        this.log(this.lastOutput);
    }
    writeToStderr(data) {
        if (this.isUnmounted) {
            return;
        }
        if (this.options.debug) {
            this.options.stderr.write(data);
            this.options.stdout.write(this.fullStaticOutput + this.lastOutput);
            return;
        }
        if (isCi) {
            this.options.stderr.write(data);
            return;
        }
        this.log.clear();
        this.options.stderr.write(data);
        this.log(this.lastOutput);
    }
    // eslint-disable-next-line @typescript-eslint/ban-types
    unmount(error) {
        if (this.isUnmounted) {
            return;
        }
        this.onRender();
        this.unsubscribeExit();
        if (typeof this.restoreConsole === 'function') {
            this.restoreConsole();
        }
        if (typeof this.unsubscribeResize === 'function') {
            this.unsubscribeResize();
        }
        // CIs don't handle erasing ansi escapes well, so it's better to
        // only render last frame of non-static output
        if (isCi) {
            this.options.stdout.write(this.lastOutput + '\n');
        }
        else if (!this.options.debug) {
            this.log.done();
        }
        this.isUnmounted = true;
        reconciler.updateContainer(null, this.container, null, noop);
        instances.delete(this.options.stdout);
        if (error instanceof Error) {
            this.rejectExitPromise(error);
        }
        else {
            this.resolveExitPromise();
        }
    }
    async waitUntilExit() {
        if (!this.exitPromise) {
            this.exitPromise = new Promise((resolve, reject) => {
                this.resolveExitPromise = resolve;
                this.rejectExitPromise = reject;
            });
        }
        return this.exitPromise;
    }
    clear() {
        if (!isCi && !this.options.debug) {
            this.log.clear();
        }
    }
    patchConsole() {
        if (this.options.debug) {
            return;
        }
        this.restoreConsole = patchConsole((stream, data) => {
            if (stream === 'stdout') {
                this.writeToStdout(data);
            }
            if (stream === 'stderr') {
                const isReactMessage = data.startsWith('The above error occurred');
                if (!isReactMessage) {
                    this.writeToStderr(data);
                }
            }
        });
    }
}
//# sourceMappingURL=ink.js.map