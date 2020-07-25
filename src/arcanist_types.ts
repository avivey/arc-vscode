/* {
    "line": 248,
    "char": 23,
    "code": "SPELL1",
    "severity": "warning",
    "name": "Possible Spelling Mistake",
    "description": "Possible spelling error. You wrote 'seperator', but did you mean 'separator'?",
    "original": "Seperator",
    "replacement": "Separator",
    "granularity": 1,
    "locations": [],
    "bypassChangedLineFiltering": null,
    "context": "    magic = COLOR_RED;\n    break;\n  case 30:\n    // printf(\"Record Seperator\");\n    magic = COLOR_BLUE;\n    break;\n  case 31:"
} */
export interface ArcanistLintMessage {
    line: number;
    char: number;
    code: string;
    severity: string; // could technically be an enum
    name: string;
    description?: string;
    original?: string;
    replacement?: string;
    // locations: string[];
    // context: string;
}
