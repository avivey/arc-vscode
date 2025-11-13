import * as vscode from 'vscode';
import spawn, { Options, SubprocessError } from 'nano-spawn';
import path from 'node:path';

var LOG: vscode.LogOutputChannel;

export function setup(log: vscode.LogOutputChannel) {
    LOG = log;
}

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
type Handler = ((x: ExecResult) => void);

export type ConduitHandler = (x: ConduitResponse) => void;
export interface ConduitResponse {
    error?: string; // TODO check
    errorMessage?: string; // TODO check
    response: any;
}

export function arc(args: string[], handler: Handler, cwd?: string) {
    arcExec(args, cwd).then(handler, handler);
}

type MyOpts = {
    cwd?: string | vscode.Uri;
}

async function _arc(args: string[], options?: Options | MyOpts): Promise<ExecResult> {
    if (options?.cwd instanceof vscode.Uri) {
        options.cwd = options.cwd.fsPath;
    }
    options = options as Options;

    try {
        let p = await spawn('arc', args, options);
        return {
            stdout: p.stdout,
            stderr: p.stderr,
            exitCode: 0
        };
    } catch (error) {
        let e = error as SubprocessError;
        LOG.error(e);
        return {
            stdout: e.stdout,
            stderr: e.stderr,
            exitCode: e.exitCode ?? 255,
        };
    }
}

export async function arcExec(args: string[], cwd?: string | vscode.Uri): Promise<ExecResult> {
    return _arc(args, { cwd });
}

export async function callConduit(method: string, body: object, cwd?: string | vscode.Uri): Promise<ConduitResponse> {
    let v = await _arc(['call-conduit', '--', method], {
        cwd,
        stdin: { string: JSON.stringify(body) },
    });
    try {
        return JSON.parse(v.stdout);
    } catch (error) {

        if (v.stderr.match(/This command needs to communicate with a server, but no server URI/)) {
            throw "No Phorge URI is configured";
        }

        LOG.warn(JSON.stringify({
            message: "failed to parse Conduit response json",
            stdout: v.stdout,
            stderr: v.stderr,
            method,
            cwd,
        }));
        throw error;
    }
}

/**
 * Try to find a good workdir to invoke `arc` in for a specific file.
 */
export function findArcRoot(uri: vscode.Uri): vscode.Uri | undefined {

    if (uri.scheme == 'untitled') {
        // Unsaved file, just try to find any root that might work
        if (vscode.workspace.workspaceFolders) {
            return vscode.workspace.workspaceFolders[0].uri;
        }
    }

    if (uri.scheme != 'file') {
        return undefined;
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
        return folder.uri;
    }
    const dir = path.dirname(uri.fsPath)
    return vscode.Uri.file(dir);
}
