import * as vscode from 'vscode';

import { callConduit, findArcRoot } from './exec_arc';
import pDebounce from 'p-debounce';

export function setup(context: vscode.ExtensionContext): Array<vscode.Disposable> {

    const panel: RemarkupPreviewPanel = new RemarkupPreviewPanel(context);

    return [
        vscode.commands.registerCommand('arc-vscode.previewRemarkup', () => {
            panel.show();
            panel.setSource(vscode.window.activeTextEditor?.document);
        }),
        vscode.workspace.onDidChangeTextDocument(e => panel.onDocumentChangedEvent(e)),
        panel,
    ];
}


class RemarkupPreviewPanel {

    private readonly baseUri: vscode.Uri;
    private panel?: vscode.WebviewPanel;
    private source?: vscode.TextDocument;

    private cssUri?: vscode.Uri;
    private update;

    constructor(context: vscode.ExtensionContext) {
        this.baseUri = context.extensionUri;
        this.update = pDebounce.promise(this.updateNow, { after: true });
    }

    private getPanel(): vscode.WebviewPanel {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'remarkupPreview',
                'Remarkup!',
                vscode.ViewColumn.Beside,
                RemarkupPreviewPanel.getWebviewOptions(this.baseUri)
            );

            this.panel.onDidDispose(e => this.panel = undefined);

            let styleUri = vscode.Uri.joinPath(this.baseUri, 'resources', 'remarkup.css');
            this.cssUri = this.panel.webview.asWebviewUri(styleUri);
        }
        return this.panel;
    }

    private async updateNow() {
        if (!this.panel) {
            return;
        }

        if (!this.source) {
            return;
        }
        let content = this.source.getText();
        if (!content) {
            return;
        }

        let call_body = {
            context: "maniphest",
            contents: [content],
        };
        try {
            let result = await callConduit('remarkup.process', call_body, findArcRoot(this.source.uri));
            content = result.response[0].content;
        } catch (e) {
            content = 'error: ' + e;
        }

        let head = `<link rel="stylesheet" href="${this.cssUri}">`;
        this.panel.webview.html = `
        <head>${head}</head>
        <body>
            <div class="phui-box phui-box-border phui-object-box mlt mll mlr">
                <div class="phui-box pl">
                    <div class="phabricator-remarkup">
                        ${content}
                    </div>
                </div>
            </div>
        </body>`;
    }

    public show() {
        this.getPanel().reveal();
    }

    onDocumentChangedEvent(event: vscode.TextDocumentChangeEvent) {
        this.setSource(event.document);
    }

    setSource(document?: vscode.TextDocument) {
        if (document)
            this.source = document;

        this.update();
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
    }

    private static getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
        return {
            enableScripts: false,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
        };
    }
}
