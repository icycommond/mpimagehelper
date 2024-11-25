import vscode, { TextDocument, Position } from "vscode";
import path from "path";
import { extraPath, fetchImgInfo, IMAGE_TYPE } from "./utils";

interface PluginSettings {
  /** 预览图片的宽度 */
  previewWidth: number;
  /** 需要忽略的图片地址 */
  ignore: (string | RegExp)[];
  /** 支持的文档类型，见 https://code.visualstudio.com/api/references/document-selector */
  languages: string[];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // 注册替换图片 URL 的命令
  const replaceImageUrlCommand = vscode.commands.registerCommand(
    "extension.replaceImageUrl",
    async (position: vscode.Position) => {
      // console.log(`position param`, `${JSON.stringify(position)}`);
      const editor = vscode.window.activeTextEditor;
      // 获取剪切板内容
      const clipboardText = await vscode.env.clipboard.readText();

      const { line, character } = position;
      if (editor) {
        const document = editor.document;
        const targetPosition = new vscode.Position(line, character);

        // 创建一个新的 Selection 对象，表示新的光标位置
        editor.selection = new vscode.Selection(targetPosition, targetPosition);
        // 滚动到指定行
        // editor.revealRange(new vscode.Range(position, position));
        setTimeout(() => {
          vscode.commands.executeCommand("type", { text: "" });
          setTimeout(() => {
            editor.edit((editBuilder) => {
              const range = document.getWordRangeAtPosition(
                targetPosition,
                /((https?):)?\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g
              );
              console.log(`range editor: ${JSON.stringify(range)}`);
              if (range) {
                try {
                  // console.log(`editBuilder`, JSON.stringify(editBuilder));
                  editBuilder.replace(range, clipboardText); // 替换为
                } catch (error) {
                  console.log(`error: `, error);
                }
              }
            });

            vscode.window.showInformationMessage(
              `Image URL replaced`
            );
          }, 100);
        }, 100);
      }
    }
  );

  context.subscriptions.push(
    replaceImageUrlCommand
  );

  // !! hover
  // const settings = {
  //   showSize: false,
  //   ignore: [],
  //   languages: ["markdown", "javascript", "typescript", "vue", "html"],
  // };
  const settings = vscode.workspace.getConfiguration("mpimagehelper");
  const { previewWidth, ignore, languages } = settings as any as PluginSettings;

  async function provideHover(document: TextDocument, position: Position) {
    const fileName = document.fileName;

    const { line: lineNumber, character: colNumber } = position;
    // logger.log(position);
    const line = document.lineAt(lineNumber);
    const lineText = line.text;
    const workDir = path.dirname(fileName);
    const ext = path.extname(fileName);

    // console.log(lineText);
    const isImportModule =
      lineText.match(/import\b/) || lineText.indexOf("require") !== -1;

    if (isImportModule) {
      return;
    }

    try {
      const originalImage = await extraPath(lineText, {
        dir: workDir,
        col: colNumber,
        ignore,
      });

      if (originalImage === null) {
        return;
      }
      const { type, path: url } = originalImage;
      if (url === null) {
        return;
      }
      if (type === IMAGE_TYPE.Local && ext.toLowerCase() === ".md") {
        return;
      }

      const {width, height} = await fetchImgInfo(originalImage);
      
      const range = document.getWordRangeAtPosition(position, /https?:\/\/\S+/);
      const markdownString = new vscode.MarkdownString(
        `<p>${width} x ${height}</p><a href="command:extension.replaceImageUrl?${encodeURIComponent(
          JSON.stringify(range)
        )}"><img src="${url}" width="${previewWidth}" /></a>`
      );
      markdownString.supportHtml = true;
      markdownString.isTrusted = true; // 允许执行命令
      // console.log(`hover range:`, range);
      return new vscode.Hover(markdownString, range);
    } catch (err) {
      // logger.error(err);
    }
  }
  languages.forEach((language) => {
    vscode.languages.registerHoverProvider(language, {
      provideHover,
    });
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
