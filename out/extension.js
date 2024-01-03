"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = exports.CodeActionProvider = exports.getSelectedText = exports.nextElementIsValid = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const cp = require("child_process");
const elegantSpinner = require("elegant-spinner");
let myStatusBarItem;
const outputChannel = vscode.window.createOutputChannel('build_runner');
const nextElementIsValid = (code, length) => {
    for (let index = 0; index < 1000; index++) {
        const text = code.charAt(length).trim();
        if (text) {
            if (/[;),\]]/.test(text)) {
                return true;
            }
            else {
                return false;
            }
        }
        length++;
    }
    return false;
};
exports.nextElementIsValid = nextElementIsValid;
const getSelectedText = (editor) => {
    let offset_l = editor.document.offsetAt(editor.selection.start);
    let offset_r = editor.document.offsetAt(editor.selection.end) - 1;
    let text = editor.document.getText();
    const re = /[^a-zA-Z]/;
    for (let index = (text.length - offset_l); index > 0; index--) {
        let textOff = text.charAt(offset_l);
        if (textOff !== '.' && re.test(textOff)) {
            offset_l++;
            if (/[^A-Z]/.test(text.charAt(offset_l))) {
                return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
            }
            let lineText = editor.document.lineAt(editor.document.positionAt(offset_l).line).text;
            if (lineText.indexOf('class') != -1 || lineText.indexOf('extends') != -1 || lineText.indexOf('with') != -1 || lineText.indexOf('implements') != -1 || lineText.indexOf('=') != -1) {
                return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
            }
            break;
        }
        else {
            offset_l--;
        }
    }
    let l = 0;
    let r = 0;
    for (let index = (text.length - offset_r); index < text.length; index++) {
        if (text.charAt(offset_r) === '(') {
            l++;
        }
        if (text.charAt(offset_r) === ')') {
            r++;
        }
        if (r > l || index == text.length) {
            offset_r = 0;
            offset_l = 0;
            break;
        }
        if (l > 0 && l == r) {
            offset_r++;
            if (!(0, exports.nextElementIsValid)(text, offset_r)) {
                offset_r = 0;
                offset_l = 0;
            }
            break;
        }
        offset_r++;
    }
    return new vscode.Selection(editor.document.positionAt(offset_l), editor.document.positionAt(offset_r));
};
exports.getSelectedText = getSelectedText;
class CodeActionProvider {
    provideCodeActions() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }
        const selectedText = editor.document.getText((0, exports.getSelectedText)(editor));
        const codeActions = [];
        if (selectedText !== '') {
            codeActions.push({
                command: "flutterBuildRunnerMobx.extension.wrapObserver",
                title: "Wrap with Observer"
            });
        }
        return codeActions;
    }
}
exports.CodeActionProvider = CodeActionProvider;
function activate(context) {
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ pattern: "**/*.{dart,dartx}", scheme: "file" }, new CodeActionProvider()));
    let disposableWrapObserver = vscode.commands.registerCommand('flutterBuildRunnerMobx.extension.wrapObserver', async () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selectedText = (0, exports.getSelectedText)(editor);
        const text = editor.document.getText(selectedText);
        const newTextWidget = `Observer(builder: (_) {return ${text};})`;
        await editor.edit(edit => {
            edit.replace(selectedText, newTextWidget);
        });
        await vscode.commands.executeCommand("editor.action.formatDocument");
    });
    context.subscriptions.push(disposableWrapObserver);
    const myCommandId = 'flutterBuildRunnerMobx.extension.BuildRunnerWatch';
    // create a new status bar item that we can now manage
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
    myStatusBarItem.command = myCommandId;
    context.subscriptions.push(myStatusBarItem);
    var child = null;
    let disposableBuildRunnerWatch = vscode.commands.registerCommand(myCommandId, async () => {
        if (child === null) {
            const select = await vscode.window.showQuickPick([
                "build_runner build",
                "build_runner watch",
                "build_runner build --delete-conflicting-outputs",
                "build_runner clean",
                "=========================================================",
                "fvm build_runner build",
                "fvm build_runner watch",
                "fvm build_runner build --delete-conflicting-outputs",
                "fvm build_runner clean",
                "=========================================================",
                "flutter pub get",
                "fvm flutter pub get",
                "=========================================================",
                "flutter pub upgrade",
                "fvm flutter pub upgrade",
            ], { placeHolder: "Select command" });
            if (!select || select.includes("===============")) {
                return;
            }
            let type = TypeButton.none;
            if (select.includes("build_runner build")) {
                type = TypeButton.build;
            }
            else if (select.includes("build_runner watch")) {
                type = TypeButton.watch;
            }
            else if (select.includes("build_runner clean")) {
                type = TypeButton.clean;
            }
            let str = "";
            if (select.includes("build_runner")) {
                if (select.startsWith("fvm")) {
                    let modifiedString = select.replace(new RegExp("fvm ", "g"), "");
                    str = `fvm flutter packages pub run ${modifiedString}`;
                }
                else {
                    str = `flutter packages pub run ${select}`;
                }
            }
            else {
                str = select;
            }
            updateButton(TypeButton.wait);
            child = cp.spawn(str, [], {
                windowsVerbatimArguments: true,
                cwd: vscode.workspace.rootPath,
                shell: true
            });
            child.addListener('close', (err) => {
                const log = err.toString();
                outputChannel.appendLine(log);
                updateButton(TypeButton.none);
                if (err === 0) {
                    vscode.window.showInformationMessage(`build_runner close ${err}`);
                }
                else {
                    if (err === 65) {
                        vscode.window.showInformationMessage(`No pubspec.lock file found, please run "flutter pub get" first.\n pub finished with exit code ${err}`);
                    }
                    else if (err === 65) {
                        vscode.window.showInformationMessage(`Could not find a file named "pubspec.yaml".\n pub finished with exit code ${err}`);
                    }
                    child.removeAllListeners();
                    child = null;
                    console.error(`Child process closed with code ${err}`);
                }
            });
            child.addListener('error', (err) => {
                const log = err.toString();
                outputChannel.appendLine(log);
                updateButton(TypeButton.none);
                child.removeAllListeners();
                child = null;
                vscode.window.showInformationMessage(`build_runner error:${err}`);
            });
            child.stdout.on('data', (data) => {
                const log = data.toString();
                outputChannel.appendLine(log);
                if (data.indexOf('Succeeded after') !== -1) {
                    if (type === TypeButton.watch) {
                        updateButton(TypeButton.unwatch);
                    }
                    else {
                        updateButton(type);
                        child.removeAllListeners();
                        child = null;
                    }
                    vscode.window.showInformationMessage('build_runner Success');
                }
                else {
                    updateButton(TypeButton.loading);
                }
            });
        }
        else {
            outputChannel.appendLine("close watch");
            child.removeAllListeners();
            child.kill('SIGINT');
            child = null;
            updateButton(TypeButton.none);
        }
    });
    updateButton(TypeButton.none);
    myStatusBarItem.show();
    context.subscriptions.push(disposableBuildRunnerWatch);
}
exports.activate = activate;
function updateButton(type) {
    if (prevNowPlaying && type !== TypeButton.loading) {
        clearInterval(prevNowPlaying);
        prevNowPlaying = null;
    }
    if (type === TypeButton.wait) {
        myStatusBarItem.text = `$(file-binary) build_runner waiting`;
    }
    else if (type === TypeButton.none || type === TypeButton.build || type === TypeButton.clean) {
        myStatusBarItem.text = `$(file-binary) build_runner`;
    }
    else if (type === TypeButton.watch) {
        myStatusBarItem.text = `$(file-binary) build_runner watch`;
    }
    else if (type === TypeButton.unwatch) {
        myStatusBarItem.text = `$(file-binary) build_runner unwatch`;
    }
    else if (type === TypeButton.loading) {
        if (!prevNowPlaying) {
            myStatusBarItem.text = `${frame()} build_runner runner`;
            prevNowPlaying = setInterval(() => {
                myStatusBarItem.text = `${frame()} build_runner runner`;
            }, 500);
        }
    }
}
var prevNowPlaying = null;
const frame = elegantSpinner();
var TypeButton;
(function (TypeButton) {
    TypeButton[TypeButton["none"] = 0] = "none";
    TypeButton[TypeButton["build"] = 1] = "build";
    TypeButton[TypeButton["loading"] = 2] = "loading";
    TypeButton[TypeButton["watch"] = 3] = "watch";
    TypeButton[TypeButton["unwatch"] = 4] = "unwatch";
    TypeButton[TypeButton["clean"] = 5] = "clean";
    TypeButton[TypeButton["wait"] = 6] = "wait";
})(TypeButton || (TypeButton = {}));
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map