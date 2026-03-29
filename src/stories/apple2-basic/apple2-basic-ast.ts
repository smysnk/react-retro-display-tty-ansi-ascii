export type Apple2BasicValue = number | string;

export type Apple2BasicExpression =
  | {
      type: "number-literal";
      value: number;
    }
  | {
      type: "string-literal";
      value: string;
    }
  | {
      type: "variable";
      name: string;
    }
  | {
      type: "unary";
      operator: "-";
      operand: Apple2BasicExpression;
    }
  | {
      type: "binary";
      operator: "+" | "-" | "*" | "/" | "=" | "<>" | "<" | "<=" | ">" | ">=";
      left: Apple2BasicExpression;
      right: Apple2BasicExpression;
    };

export type Apple2BasicThenBranch =
  | {
      type: "line-number";
      lineNumber: number;
    }
  | {
      type: "statement";
      statement: Apple2BasicStatement;
    };

export type Apple2BasicStatement =
  | {
      type: "rem";
      comment: string;
    }
  | {
      type: "print";
      expressions: Apple2BasicExpression[];
    }
  | {
      type: "assignment";
      variable: string;
      expression: Apple2BasicExpression;
    }
  | {
      type: "input";
      variable: string;
      prompt: string | null;
    }
  | {
      type: "goto";
      lineNumber: number;
    }
  | {
      type: "if";
      condition: Apple2BasicExpression;
      thenBranch: Apple2BasicThenBranch;
    }
  | {
      type: "end";
    };
