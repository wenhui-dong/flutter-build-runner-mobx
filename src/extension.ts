// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import cp = require('child_process');
import elegantSpinner = require('elegant-spinner');

let myStatusBarItem: vscode.StatusBarItem;
const outputChannel = vscode.window.createOutputChannel('build_runner');
export const nextElementIsValid = (code: string, length: number): Boolean => {
  for (let index = 0; index < 1000; index++) {
    const text = code.charAt(length).trim();
    if (text) {
      if (/[;),\]]/.test(text)) {
        return true;
      } else {
        return false;
      }
    }
    length++;

  }
  return false;

};

export const getSelectedText = (editor: vscode.TextEditor): vscode.Selection => {
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
      let lineText: string = editor.document.lineAt(editor.document.positionAt(offset_l).line).text;
      if (lineText.indexOf('class') != -1 || lineText.indexOf('extends') != -1 || lineText.indexOf('with') != -1 || lineText.indexOf('implements') != -1 || lineText.indexOf('=') != -1) {
        return new vscode.Selection(editor.document.positionAt(0), editor.document.positionAt(0));
      }

      break;
    } else {
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
      r++
    }

    if (r > l || index == text.length) {
      offset_r = 0;
      offset_l = 0;
      break;
    }

    if (l > 0 && l == r) {
      offset_r++;
      if (!nextElementIsValid(text, offset_r)) {
        offset_r = 0;
        offset_l = 0;
      }
      break;
    }
    offset_r++;

  }

  return new vscode.Selection(editor.document.positionAt(offset_l), editor.document.positionAt(offset_r));
};


export class CodeActionProvider implements vscode.CodeActionProvider {
  public provideCodeActions(): vscode.Command[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [];
    }

    const selectedText = editor.document.getText(getSelectedText(editor));
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


export function activate(context: vscode.ExtensionContext) {


  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: "**/*.{dart,dartx}", scheme: "file" },
      new CodeActionProvider()
    )
  );


  let disposableWrapObserver = vscode.commands.registerCommand('flutterBuildRunnerMobx.extension.wrapObserver', async () => {
    let editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    const selectedText = getSelectedText(editor);
    const text = editor.document.getText(selectedText);
    const newTextWidget = `Observer(builder: (_) {return ${text};})`;

    await editor.edit(edit => {
      edit.replace(selectedText, newTextWidget);
    });
    await vscode.commands.executeCommand(
      "editor.action.formatDocument"
    );
  });

  context.subscriptions.push(disposableWrapObserver);

  const myCommandId = 'flutterBuildRunnerMobx.extension.BuildRunnerWatch';

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
  myStatusBarItem.command = myCommandId;
  context.subscriptions.push(myStatusBarItem);
  var child: any = null;

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
        "fvm flutter pub upgrade",],
        { placeHolder: "Select command" }
      );
      if (!select || select.includes("===============")) {
        return;
      }
      let type: TypeButton = TypeButton.none;
      if (select.includes("build_runner build")) {
        type = TypeButton.build;
      } else if (select.includes("build_runner watch")) {
        type = TypeButton.watch;
      } else if (select.includes("build_runner clean")) {
        type = TypeButton.clean;
      }
      let str = "";
      if (select.includes("build_runner")) {
        if (select.startsWith("fvm")) {
          let modifiedString = select.replace(new RegExp("fvm ", "g"), "");
          str = `fvm flutter packages pub run ${modifiedString}`;
        } else {
          str = `flutter packages pub run ${select}`;
        }
      } else {

        str = select;
      }


      updateButton(TypeButton.wait);
      child = cp.spawn(str, [], {
        windowsVerbatimArguments: true,
        cwd: vscode.workspace.rootPath,
        shell: true
      });

      child.addListener('close', (err: any) => {
        const log = err.toString();
        outputChannel.appendLine(log);
        updateButton(TypeButton.none);

        if (err === 0) {
          vscode.window.showInformationMessage(`build_runner close ${err}`);
        } else {
          if (err === 65) {
            vscode.window.showInformationMessage(`No pubspec.lock file found, please run "flutter pub get" first.\n pub finished with exit code ${err}`);
          }else if(err === 65){
            vscode.window.showInformationMessage(`Could not find a file named "pubspec.yaml".\n pub finished with exit code ${err}`);
          }
          (child as cp.ChildProcessWithoutNullStreams).removeAllListeners();
          child = null;
          console.error(`Child process closed with code ${err}`);
        }

      });

      child.addListener('error', (err: any) => {
        const log = err.toString();
        outputChannel.appendLine(log);
        updateButton(TypeButton.none);
        (child as cp.ChildProcessWithoutNullStreams).removeAllListeners();
        child = null;
        vscode.window.showInformationMessage(`build_runner error:${err}`);
      });


      child.stdout.on('data', (data: any) => {
        const log = data.toString();
        outputChannel.appendLine(log);
        if ((data as string).indexOf('Succeeded after') !== -1) {
          if (type === TypeButton.watch) {
            updateButton(TypeButton.unwatch);
          } else {
            updateButton(type);
            (child as cp.ChildProcessWithoutNullStreams).removeAllListeners();
            child = null;
          }
          vscode.window.showInformationMessage('build_runner Success');
        } else {
          updateButton(TypeButton.loading);
        }
      });

    } else {
      outputChannel.appendLine("close watch");
      (child as cp.ChildProcessWithoutNullStreams).removeAllListeners();
      (child as cp.ChildProcessWithoutNullStreams).kill('SIGINT');
      child = null;
      updateButton(TypeButton.none);
    }

  });

  updateButton(TypeButton.none);
  myStatusBarItem.show();
  context.subscriptions.push(disposableBuildRunnerWatch);
}


function updateButton(type: TypeButton) {
  if (prevNowPlaying && type !== TypeButton.loading) {
    clearInterval(prevNowPlaying);
    prevNowPlaying = null;
  }
  if (type === TypeButton.wait) {
    myStatusBarItem.text = `$(file-binary) build_runner waiting`;
  } else if (type === TypeButton.none || type === TypeButton.build || type === TypeButton.clean) {
    myStatusBarItem.text = `$(file-binary) build_runner`;
  } else if (type === TypeButton.watch) {
    myStatusBarItem.text = `$(file-binary) build_runner watch`;
  } else if (type === TypeButton.unwatch) {
    myStatusBarItem.text = `$(file-binary) build_runner unwatch`;
  } else if (type === TypeButton.loading) {
    if (!prevNowPlaying) {
      myStatusBarItem.text = `${frame()} build_runner runner`;
      prevNowPlaying = setInterval(() => {
        myStatusBarItem.text = `${frame()} build_runner runner`;
      }, 500);
    }
  }
}
var prevNowPlaying: any = null;
const frame = elegantSpinner();
enum TypeButton {
  none, build, loading, watch, unwatch, clean, wait
}




export function deactivate() { }