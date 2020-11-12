import * as execa from 'execa';

export type ReturnValue = execa.ExecaReturnValue<string>;
type Handler = ((x: execa.ExecaReturnValue<string>) => void);

export type ConduitHandler = (x: ConduitResponse) => void;
export interface ConduitResponse {
    error?: string; // TODO check
    errorMessage?: string; // TODO check
    response: any;
}

export function arc(args: string[], handler: Handler, cwd?: string) {
    execa('arc', args, { cwd: cwd }).then(handler, handler);
}

export function callConduit(method: string, body: object, handler: ConduitHandler, cwd?: string) {
    function hs(value: execa.ExecaReturnValue<string>) {
        const output = JSON.parse(value.stdout);
        handler(output);
    }
    execa('arc', ['call-conduit', '--', method], {
        input: JSON.stringify(body),
        cwd: cwd,
    }).then(hs, hs);
}
