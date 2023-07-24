import * as vscode from 'vscode';
import * as lint from './arc_lint';
import * as browse from './arc_browse';
import * as hovercard from './hovercard';

export function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel("arcanist");

	const diagnostics = vscode.languages.createDiagnosticCollection('arc lint');

	lint.setup(log, diagnostics);
	browse.setup(log);

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}
	d(diagnostics);
	d(log);

	d(hovercard.register());

	d(vscode.commands.registerCommand("arc-vscode.browseFile", browse.browseFile));

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => diagnostics.clear()));
	d(vscode.commands.registerCommand('arc-vscode.lintEverything', lint.lintEverything));

	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidChangeConfiguration(onChangeConfig));

	if (vscode.window.activeTextEditor) {
		lint.lintFile(vscode.window.activeTextEditor.document);
	}

	d(vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)));

	function onTextDocumentEvent(document: vscode.TextDocument) {
		lint.lintFile(document);
	}

}

export function deactivate() { }

function onChangeConfig(e: vscode.ConfigurationChangeEvent) {
	if (!e.affectsConfiguration('arc-vscode.lint')) {
		return;
	}
	lint.updateLintSeverityMap();
}
