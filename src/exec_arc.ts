import * as vscode from 'vscode';
import spawn, { Options, SubprocessError } from 'nano-spawn';
import path from 'node:path';

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
        console.log(error);
        let e = error as SubprocessError;
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
    },
    );
    return JSON.parse(v.stdout);
}

/**
 * Try to find a good workdir to invoke `arc` in for a specific file.
 */
export function findArcRoot(uri: vscode.Uri): vscode.Uri | undefined {
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
