import spawn, { Result, SubprocessError } from 'nano-spawn';

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

export async function arcExec(args: string[], cwd?: string): Promise<ExecResult> {
    try {
        let p = await spawn('arc', args, { cwd: cwd });
        return {
            stdout: p.stdout,
            stderr: p.stderr,
            exitCode: 0
        };
    } catch (error) {
        let e = error as SubprocessError;
        return {
            stdout: e.stdout,
            stderr: e.stderr,
            exitCode: e.exitCode ?? 255,
        };
    }
}

export function callConduit(method: string, body: object, handler: ConduitHandler, cwd?: string) {
    function hs(value: Result) {
        const output = JSON.parse(value.stdout);
        handler(output);
    }
    spawn('arc', ['call-conduit', '--', method], {
        stdin: JSON.stringify(body),
        cwd: cwd,
    }).then(hs, hs);
}
