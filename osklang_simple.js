function exists(val) {
  return val !== undefined && val !== null;
}
function truthy(val) {
  return ![
    null,
    undefined,
    false
  ].includes(val);
}
function mod(n, m) {
  return ((n % m) + m) % m;
}
function type(val) {
  if (val === null) return 'nil';
  if (val?.constructor === Array) return 'list';
  return typeof val;
}
function sleep(delay) {
  const start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}

import prompt_sync from "prompt-sync";
import { XMLHttpRequest } from "xmlhttprequest";
import { readFileSync } from 'fs';
const prompt = prompt_sync();

const TOKEN = {
  PLUS         :   'PLUS',         // +
  MIN          :   'MIN',          // -
  MUL          :   'MUL',          // *
  DIV          :   'DIV',          // /
  MOD          :   'MOD',          // %
  INT          :   'INT',          // 42
  FLOAT        :   'FLOAT',        // 4.2
  BOOLEAN      :   'BOOLEAN',      // true | false
  STRING       :   'STRING',       // 'foo' | "bar"
  NIL          :   'NIL',          // nil
  NOT          :   'NOT',          // !
  AND          :   'AND',          // &&
  OR           :   'OR',           // ||
  EQ           :   'EQ',           // =
  EE           :   'EE',           // ==
  NE           :   'NE',           // !=
  GTE          :   'GTE',          // >=
  GT           :   'GT',           // >
  LTE          :   'LTE',          // <=
  LT           :   'LT',           // <
  ARROW        :   'ARROW',        // =>
  PE           :   'PE',           // +=
  ME           :   'ME',           // -=
  LPAREN       :   'LPAREN',       // (
  RPAREN       :   'RPAREN',       // )
  LSQUARE      :   'LSQUARE',      // [
  RSQUARE      :   'RSQUARE',      // ]
  COMMA        :   'COMMA',        // ,
  IDENTIFIER   :   'IDENTIFIER',   // foo
  KEYWORD      :   'KEYWORD',      // function
  NEWLINE      :   'NEWLINE',      // \n | ;
  EOF          :   'EOF'           // <EOF>
}

const KEYWORDS = [
  'function',
  'return',
  'for',
  'while',
  'if',
  'elif',
  'else',
  'do',
  'end'
]

const DIGITS = '1234567890';
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/*** ERRORS ***/
class OsklangError {
  constructor(start, end, name, details) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.details = details;
    this.lineText = start.fileText.split('\r\n')[start.line];
  }
}
OsklangError.prototype.toString = function() {
  return `${this.name}: ${this.details}
  File ${this.start.fileName}, line ${this.start.line + 1}, column ${this.start.column + 1}`;
}

class IllegalCharError extends OsklangError {
  constructor(start, end, details) {
    super(start, end, 'Illegal Character', details);
  }
}
class InvalidSyntaxError extends OsklangError {
  constructor(start, end, details) {
    super(start, end, 'Invalid Syntax', details);
  }
}
class RuntimeError extends OsklangError {
  constructor(start, end, details, context) {
    super(start, end, 'Runtime Error', details);
    this.context = context;
  }

  generateTraceback() {
    let result = '';
    let pos = this.start;
    let ctx = this.context;

    while (ctx) {
      result += `  File ${pos.fileName}, line ${pos.line + 1}, column ${pos.column + 1}, in ${ctx.displayName}\n`;
      pos = ctx.pos;
      ctx = ctx.parent;
    }

    return 'Traceback (most recent call first):\n' + result;
  }
}
RuntimeError.prototype.toString = function () {
  return `${this.name}: ${this.details}\n${this.generateTraceback()}`;
}

/*** LEXICAL POSITIONS ***/
class Position {
  constructor(index, line, column, fileName, fileText) {
    this.index = index;
    this.line = line;
    this.column = column;
    this.fileName = fileName;
    this.fileText = fileText;
  }

  advance(currentChar = null) {
    this.index++;
    this.column++;

    if (currentChar === '\n') {
      this.line++;
      this.column = 0;
    }

    return this;
  }

  reverse() {
    this.index--;
    this.column--;

    if (this.index === -1) {
      this.line--;
      this.column = this.fileText.split('\r\n')[this.line].length;
    }

    return this;
  }

  copy() {
    return new Position(this.index, this.line, this.column, this.fileName, this.fileText);
  }
}


/*** TOKENIZER ***/
class Token {
  constructor(type, value = null, start, end = null) {
    this.type = type;
    this.value = value;

    this.start = start.copy();
    this.end = start.copy();
    this.end.advance();
    if (exists(end)) this.end = end.copy();
  }
  asString() {
    switch (this.type) {
      case TOKEN.PLUS: return '+';
      case TOKEN.MIN: return '-';
      case TOKEN.MUL: return '*';
      case TOKEN.DIV: return '/';
      case TOKEN.MOD: return '%';
      case TOKEN.INT:
      case TOKEN.FLOAT:
      case TOKEN.BOOLEAN:
      case TOKEN.STRING:
      case TOKEN.NIL:
      case TOKEN.KEYWORD:
      case TOKEN.IDENTIFIER: return this.value.toString();
      case TOKEN.NOT: return '!';
      case TOKEN.EQ: return '=';
      case TOKEN.EE: return '==';
      case TOKEN.NE: return '!=';
      case TOKEN.GT: return '>';
      case TOKEN.GTE: return '>=';
      case TOKEN.LT: return '<';
      case TOKEN.LTE: return '<=';
      case TOKEN.AND: return '&&';
      case TOKEN.OR: return '||';
      case TOKEN.ARROW: return '=>';
      case TOKEN.PE: return '+=';
      case TOKEN.ME: return '-=';
      case TOKEN.LPAREN: return '(';
      case TOKEN.RPAREN: return ')';
      case TOKEN.LSQUARE: return '[';
      case TOKEN.RSQUARE: return ']';
      case TOKEN.COMMA: return ',';
      case TOKEN.NEWLINE: return '<NEWLINE>';
      case TOKEN.EOF: return '<EOF>';
    }
  }
  matches(tokenType, value) {
    if (type(value) === 'string') return this.type === tokenType && this.value === value;
    for (const val of value) {
      if (this.type === tokenType && this.value === val) return true;
    }
    return false;
  }
}

class Tokenizer {
  constructor(input, fileName) {
    this.string = input;
    this.pos = new Position(-1, 0, -1, fileName, input);
    this.currentCharacter = '';

    this.advance();
  }

  advance() {
    this.pos.advance(this.currentCharacter);
    this.currentCharacter = this.pos.index < this.string.length ? this.string[this.pos.index] : null;
  }

  reverse() {
    this.pos.reverse();
    this.currentCharacter = this.pos.index > -1 ? this.string[this.pos.index] : null;
  }

  tokenize() {
    const tokens = [];

    while (exists(this.currentCharacter)) {
      if (' \t'.includes(this.currentCharacter)) {
        this.advance();
      } else if ('\n;\r'.includes(this.currentCharacter)) {
        tokens.push(this.makeNewLine());
      } else if (DIGITS.includes(this.currentCharacter)) {
        tokens.push(this.makeDigitToken());
      } else if (LETTERS.includes(this.currentCharacter)) {
        tokens.push(this.makeIdentifierToken());
      } else if (`\`'"`.includes(this.currentCharacter)) {
        tokens.push(this.makeString())
      } else if (this.currentCharacter === '+') {
        tokens.push(this.makePlusEqualsToken());
      } else  if (this.currentCharacter === '-') {
        const token = this.makeMinusEqualsToken();
        if (token) {
          tokens.push(token);
        }
      } else if (this.currentCharacter === '*') {
        tokens.push(new Token(TOKEN.MUL, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === '/') {
        tokens.push(new Token(TOKEN.DIV, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === '%') {
        tokens.push(new Token(TOKEN.MOD, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === '(') {
        tokens.push(new Token(TOKEN.LPAREN, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === ')') {
        tokens.push(new Token(TOKEN.RPAREN, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === '[') {
        tokens.push(new Token(TOKEN.LSQUARE, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === ']') {
        tokens.push(new Token(TOKEN.RSQUARE, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === ',') {
        tokens.push(new Token(TOKEN.COMMA, null, this.pos));
        this.advance();
      } else if (this.currentCharacter === '|') {
        tokens.push(this.makeOR());
      } else if (this.currentCharacter === '&') {
        tokens.push(this.makeAND());
      } else if (this.currentCharacter === '!') {
        tokens.push(this.makeNotOrNotEquals());
      } else if (this.currentCharacter === '=') {
        tokens.push(this.makeEqualsOrArrow());
      } else if (this.currentCharacter === '>') {
        tokens.push(this.makeGreaterOrEqual());
      } else if (this.currentCharacter === '<') {
        tokens.push(this.makeLessOrEqual());
      } else {
        const char = this.currentCharacter;
        const startPos = this.pos.copy();
        this.advance();
        throw new IllegalCharError(startPos, this.pos, `'${char}'`);
      }
    }

    tokens.push(new Token(TOKEN.EOF, null, this.pos));
    return tokens;
  }

  makeDigitToken() {
    const startPos = this.pos.copy();
    let str = this.currentCharacter;
    let dots = 0;
    this.advance();
    while ((DIGITS + '.').includes(this.currentCharacter)) {
      if (this.currentCharacter === '.') {
        dots++;
        if (dots > 1) {
          this.advance();
          throw new InvalidSyntaxError(startPos, this.pos,
            'Malformed number');
        }  
      }
      str += this.currentCharacter;
      this.advance();
    }
    
    if (dots === 0) return new Token(TOKEN.INT, parseInt(str), startPos, this.pos.copy());
    return new Token(TOKEN.FLOAT, parseFloat(str), startPos, this.pos.copy());
  }

  makeIdentifierToken() {
    const startPos = this.pos.copy();
    let str = this.currentCharacter;
    
    this.advance();
    while ((LETTERS + '_').includes(this.currentCharacter)) {
      str += this.currentCharacter;
      this.advance();
    }

    if (['true', 'false'].includes(str)) {
      return new Token(TOKEN.BOOLEAN, str.includes('true'), startPos, this.pos);
    }

    if (str === 'nil') return new Token(TOKEN.NIL, null, startPos, this.pos);
    
    if (KEYWORDS.includes(str)) {
      return new Token(TOKEN.KEYWORD, str, startPos, this.pos);
    }

    return new Token(TOKEN.IDENTIFIER, str, startPos, this.pos);
  }

  makeNewLine() {
    const startPos = this.pos.copy();
    
    this.advance();
    while ('\n\r;'.includes(this.currentCharacter)) {
      this.advance();
    }
    return new Token(TOKEN.NEWLINE, null, startPos, this.pos);
  }

  makeString() {
    const delimiter = this.currentCharacter;
    let str = '';
    
    this.advance();
    const start = this.pos.copy();
    
    while (exists(this.currentCharacter) && this.currentCharacter !== delimiter) {
      str += this.currentCharacter;
      this.advance();
    }

    if (this.currentCharacter !== delimiter) {
      throw new InvalidSyntaxError(start, this.pos, 'Unterminated string');
    }

    this.advance();

    return new Token(TOKEN.STRING, str, start, this.pos);
  }

  makePlusEqualsToken() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.PE, null, startPos, this.pos);
    }
    return new Token(TOKEN.PLUS, null, startPos);
  }

  makeMinusEqualsToken() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.ME, null, startPos, this.pos);
    } else if (this.currentCharacter === '-') {
      // match -- comments
      while (exists(this.currentCharacter) && this.currentCharacter !== '\n') {
        this.advance();
      }
      return new Token(TOKEN.NEWLINE, null, startPos, this.pos);
    }
    return new Token(TOKEN.MIN, null, startPos);
  }

  makeOR() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '|') {
      this.advance();
      return new Token(TOKEN.OR, null, startPos, this.pos);
    }
    this.advance();
    throw new InvalidSyntaxError(startPos, this.pos,
      `Invalid operator`)
  }

  makeAND() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '&') {
      this.advance();
      return new Token(TOKEN.AND, null, startPos, this.pos);
    }
    this.advance();
    throw new InvalidSyntaxError(startPos, this.pos,
      `Invalid operator`);
  }

  makeNotOrNotEquals() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.NE, null, startPos, this.pos);
    }
    return new Token(TOKEN.NOT, null, startPos);
  }

  makeEqualsOrArrow() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '>') {
      this.advance();
      return new Token(TOKEN.ARROW, null, startPos, this.pos);
    } else if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.EE, null, startPos, this.pos);
    }
    return new Token(TOKEN.EQ, null, startPos, this.pos);
  }

  makeGreaterOrEqual() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.GTE, null, startPos, this.pos);
    }
    return new Token(TOKEN.GT, null, startPos, this.pos);
  }

  makeLessOrEqual() {
    const startPos = this.pos.copy();
    this.advance();
    if (this.currentCharacter === '=') {
      this.advance();
      return new Token(TOKEN.LTE, null, startPos, this.pos);
    }
    return new Token(TOKEN.LT, null, startPos, this.pos);
  }
}

/*** PARSER ***/
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.tokenIndex = 0;
    this.currentToken = this.tokens[0];
  }

  advance() {
    this.tokenIndex++;
    if (this.tokenIndex < this.tokens.length) this.currentToken = this.tokens[this.tokenIndex];
  }

  parse() {
    const result = this.parseStatements();
    if (this.currentToken.type !== TOKEN.EOF) {
      throw new InvalidSyntaxError(
        this.currentToken.start, this.currentToken.end,
        `Unexpected token '${this.currentToken.asString()}'`
      );
    }
    return result;
  }

  parseStatements() {

    const statements = [];
    const start = this.currentToken.start.copy();

    while (this.currentToken.type === TOKEN.NEWLINE) {
      this.advance();
    }

    while (this.currentToken.type !== TOKEN.EOF) {
      const statement = this.parseStatement();
      statements.push(statement);

      if (this.currentToken.type !== TOKEN.NEWLINE) {
        if (this.currentToken.type === TOKEN.EOF) break;
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          `Token cannot appear after previous tokens`)
      }

      while (this.currentToken.type === TOKEN.NEWLINE) {
        this.advance();
      }

      if (this.currentToken.matches(TOKEN.KEYWORD, ['end', 'else', 'elif'])) {
        break;
      };
    }
    return new StatementNode(statements, start, this.currentToken.end);
  }

  parseStatement() {
    const start = this.currentToken.start;
    
    if (this.currentToken.matches(TOKEN.KEYWORD, 'return')) {
      this.advance();
      if ([TOKEN.EOF, TOKEN.NEWLINE].includes(this.currentToken.type)) {
        return new ReturnNode(null, start, this.currentToken.end)
      } else {
        const expr = this.parseExpr();
        return new ReturnNode(expr, start, this.currentToken.end)
      }
    }


    return this.parseExpr();
  }

  parseExpr() {

    let left = this.parseCompExpr();

    while ([TOKEN.AND, TOKEN.OR].includes(this.currentToken.type)) {
      const operationToken = this.currentToken;
      this.advance();
      const right = this.parseCompExpr();
      left = new BinaryOperatorNode(left, operationToken, right);
    }

    return left;
  }

  parseCompExpr() {

    if (this.currentToken.type === TOKEN.NOT) {
      const operationToken = this.currentToken;
      this.advance();

      const node = this.parseCompExpr();

      return new UnaryOperatorNode(operationToken, node);
    }

    let left = this.parseArithExpr();

    while ([TOKEN.EE, TOKEN.NE, TOKEN.GT, TOKEN.GTE, TOKEN.LT, TOKEN.LTE].includes(this.currentToken.type)) {
      const operationToken = this.currentToken;
      this.advance();
      const right = this.parseArithExpr();
      left = new BinaryOperatorNode(left, operationToken, right);
    }

    return left;
  }

  parseArithExpr() {
    let left = this.parseTerm();

    while ([TOKEN.PLUS, TOKEN.MIN].includes(this.currentToken.type)) {
      const operationToken = this.currentToken;
      this.advance();
      const right = this.parseTerm();
      left = new BinaryOperatorNode(left, operationToken, right);
    }

    return left;
  }

  parseTerm() {
    let left = this.parseFactor();

    while ([TOKEN.MUL, TOKEN.DIV, TOKEN.MOD].includes(this.currentToken.type)) {
      const operationToken = this.currentToken;
      this.advance();
      const right = this.parseFactor();
      left = new BinaryOperatorNode(left, operationToken, right);
    }
    return left;
  }

  parseFactor() {
    const token = this.currentToken;

    if ([TOKEN.PLUS, TOKEN.MIN].includes(token.type)) {
      this.advance();
      const factor = this.parseFactor();
      return new UnaryOperatorNode(token, factor);
    }

    return this.parseCall();
  }

  parseCall() {
    let left = this.parseAtom();
    
    let start = this.currentToken.start;

    while ([TOKEN.LPAREN, TOKEN.LSQUARE].includes(this.currentToken.type)) {
      if (this.currentToken.type === TOKEN.LPAREN) {
  
        let end;
  
        this.advance();
        const args = [];
  
        if (this.currentToken.type === TOKEN.RPAREN) {
          end = this.currentToken.end;
          
          this.advance();
        } else {
  
          args.push(this.parseExpr());
          
          while (this.currentToken.type === TOKEN.COMMA) {
            this.advance();
            args.push(this.parseExpr());
          }
  
          if (this.currentToken.type !== TOKEN.RPAREN) {
            throw new InvalidSyntaxError(
              this.currentToken.start, this.currentToken.end,
              "Expected ',' or ')'"
            );
          }
  
          end = this.currentToken.end;
  
          this.advance()
        }
        left = new CallNode(left, args, start, end);
  
      } else if (this.currentToken.type === TOKEN.LSQUARE) {
        start = this.currentToken.start;
        this.advance();
        const index = this.parseExpr();
        if (this.currentToken.type !== TOKEN.RSQUARE) {
          throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
            "Expected ']'");
        }
        const end = this.currentToken.end;
        this.advance();

        if ([TOKEN.EQ, TOKEN.PE, TOKEN.ME].includes(this.currentToken.type)) {
          const operatorToken = this.currentToken;
          this.advance();
          const expr = this.parseExpr();
          return new BinaryOperatorNode(
            new ListAccessNode(left, index, start, end), operatorToken, expr);
        }
        
        left = new ListAccessNode(left, index, start, end);
      }
    }

    return left;
  }

  parseAtom() {
    const token = this.currentToken;
    if (token.type === TOKEN.IDENTIFIER) {
      const identifier = new IdentifierNode(token);
      this.advance();
      if ([TOKEN.EQ, TOKEN.PE, TOKEN.ME].includes(this.currentToken.type)) { // =
        const operatorToken = this.currentToken;
        this.advance();
        const expr = this.parseExpr();
        return new BinaryOperatorNode(identifier, operatorToken, expr);
      } else {
        return identifier;
      }
    } else if ([TOKEN.INT, TOKEN.FLOAT].includes(token.type)) {
      this.advance();
      return new NumberNode(token);
    } else if (token.type === TOKEN.BOOLEAN) {
      this.advance();
      return new BooleanNode(token);
    } else if (token.type === TOKEN.STRING) {
      this.advance();
      return new StringNode(token);
    } else if (token.type === TOKEN.NIL) {
      this.advance();
      return new NilNode(token);
    } else if (token.type === TOKEN.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      if (this.currentToken.type === TOKEN.RPAREN) {
        this.advance();
        return expr;
      } else {
        throw new InvalidSyntaxError(
          this.currentToken.start, this.currentToken.end,
          "Expected ')'"
        )
      }
    } else if (token.type === TOKEN.LSQUARE) {
      return this.parseListExpression();
    } else if (token.matches(TOKEN.KEYWORD, 'function')) {
      return this.parseFunctionDefinition();
    } else if (token.matches(TOKEN.KEYWORD, 'for')) {
      return this.parseForStatement();
    } else if (token.matches(TOKEN.KEYWORD, 'while')) {
      return this.parseWhileStatement();
    } else if (token.matches(TOKEN.KEYWORD, 'if')) {
      return this.parseIfStatement();
    }

    throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
      `Unexpected end of input '${this.currentToken.asString()}'`);
  }

  parseFunctionDefinition() {
    const token = this.currentToken;

    if (!this.currentToken.matches(TOKEN.KEYWORD, 'function')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'function'");
    }

    this.advance();

    if (this.currentToken.type !== TOKEN.LPAREN) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected '('");
    }

    this.advance();

    const argNameTokens = [];

    if (this.currentToken.type === TOKEN.IDENTIFIER) {
      argNameTokens.push(this.currentToken);
      this.advance();

      while (this.currentToken.type === TOKEN.COMMA) {
        this.advance();

        if (this.currentToken.type !== TOKEN.IDENTIFIER) {
          throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
            'Expected identifier');
        }

        argNameTokens.push(this.currentToken);
        this.advance();
      }

      if (this.currentToken.type !== TOKEN.RPAREN) {
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          "Expected ',' or ')'");
      }
    } else {
      if (this.currentToken.type !== TOKEN.RPAREN) {
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          "Expected identifier or ')'");
      }
    }

    this.advance();

    if (this.currentToken.type === TOKEN.ARROW) {
      this.advance();
      const functionBody = this.parseExpr();
      return new FunctionDeclarationNode(null, argNameTokens.map(e => e.value), new ReturnNode(functionBody, token.start, this.currentToken.end), token, token.start, this.currentToken.end);
    } else if (this.currentToken.matches(TOKEN.KEYWORD, 'do')) {
      this.advance();
      const functionBody = this.parseStatements();
      if (!this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          "Expected 'end'");
      }

      this.advance();
      return new FunctionDeclarationNode(null, argNameTokens.map(e => e.value), functionBody, token, token.start, this.currentToken.end);
    
    } else {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        'Expected arrow or "do"');
    }
  }

  parseForStatement() {

    if (!this.currentToken.matches(TOKEN.KEYWORD, 'for')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'for'");
    }

    this.advance();
    if (this.currentToken.type !== TOKEN.IDENTIFIER) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected identifier");
    }

    const variableToken = this.currentToken;

    this.advance();
    if (this.currentToken.type !== TOKEN.EQ) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected '='");
    }

    this.advance();

    const startVal = this.parseExpr();
    
    if (this.currentToken.type !== TOKEN.COMMA) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected ','");
    }

    this.advance();

    const targetVal = this.parseExpr();

    let step;

    if (this.currentToken.type === TOKEN.COMMA) {
      this.advance();
      step = this.parseExpr();
    }

    if (this.currentToken.matches(TOKEN.KEYWORD, 'do')) {
      this.advance();
      const body = this.parseStatements();

      if (!this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          "Expected 'end'");
      }

      this.advance();
      return new ForStatementNode(variableToken, startVal, targetVal, step, body);
    } else {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'do'");
    }
  }

  parseWhileStatement() {
    if (!this.currentToken.matches(TOKEN.KEYWORD, 'while')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'while'");
    }

    this.advance();
    const condition = this.parseExpr();
    if (!this.currentToken.matches(TOKEN.KEYWORD, 'do')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'do'");
    }

    this.advance();
    const body = this.parseStatements();

    if (!this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'end'")
    }

    this.advance();
    return new WhileStatementNode(condition, body);
  }
  
  parseIfStatement() {
    if (!this.currentToken.matches(TOKEN.KEYWORD, 'if')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'if'");
    }

    const clauses = [];

    this.advance();
    const condition = this.parseExpr();
    if (!this.currentToken.matches(TOKEN.KEYWORD, 'do')) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected 'do'");
    }

    this.advance();

    const body = this.parseStatements();
    clauses.push({
      condition, body
    });

    if (this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
      this.advance();
      return new IfStatementNode(clauses);
    } else if (this.currentToken.matches(TOKEN.KEYWORD, 'elif')) {

      while (this.currentToken.matches(TOKEN.KEYWORD, 'elif')) {
        this.advance();

        const condition = this.parseExpr();
        if (!this.currentToken.matches(TOKEN.KEYWORD, 'do')) {
          throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
            "Expected 'do'");
        }

        this.advance();
        const body = this.parseStatements();

        clauses.push({
          condition, body
        });
      }

    }

    if (this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
      this.advance();
      return new IfStatementNode(clauses);
    } else {
      if (this.currentToken.matches(TOKEN.KEYWORD, 'else'));
      this.advance();
      const body = this.parseStatements();
      clauses.push({
        condition: true,
        body
      });

      if (!this.currentToken.matches(TOKEN.KEYWORD, 'end')) {
        throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
          "Expected 'end'");
      }

      this.advance();
      return new IfStatementNode(clauses);
    }

  }

  parseListExpression() {
    const elements = [];
    const start = this.currentToken.start;

    if (this.currentToken.type !== TOKEN.LSQUARE) {
      throw new InvalidSyntaxError(this.currentToken.start, this.currentToken.end,
        "Expected '['")
    }

    this.advance();

    if (this.currentToken.type === TOKEN.RSQUARE) {
      this.advance();
      return new ListNode(elements, start, this.currentToken.start);
    }

    elements.push(this.parseExpr());

    while (this.currentToken.type === TOKEN.COMMA) {
      this.advance();
      const expr = this.parseExpr();
      elements.push(expr);
    }

    if (this.currentToken.type !== TOKEN.RSQUARE) {
      throw new InvalidSyntaxError(start, this.currentToken.end,
        "Expected ']' or ','");
    }

    this.advance();
    return new ListNode(elements, start, this.currentToken.end);
  }
}

class Interpreter {
  constructor(tree, context) {
    this.tree = tree;
    this.context = context;
    this.returnValue = null;
  }

  evaluate() {
    try {
      return this.process(this.tree);
    } catch(e) {
      if (e === 'return') {
        return this.returnValue;
      } else {
        throw e;
      }
    }
  }

  process(node) {

    if (node instanceof StatementNode) {
      const list = node.statements.map(e => this.process(e));
      list.type = 'statements';
      return list;
    }

    if (node instanceof ListNode) {
      const list = node.elements.map(e => this.process(e));
      list.type = 'elements';
      return list;
    }

    if (node instanceof ReturnNode) {
      if (!exists(this.context.parent)) {
        throw new RuntimeError(node.expr.token.start, node.expr.token.end, "Cannot return from global scope");
      }
      this.returnValue = this.process(node.expr);
      throw 'return';
    }

    if (node instanceof IfStatementNode) {
      for (const c of node.clauses) {
        if (c.condition === true || truthy(this.process(c.condition))) {
          this.process(c.body);
          return null;
        }
      }
      return null;
    }

    if (node instanceof WhileStatementNode) {
      while (truthy(this.process(node.condition))) {
        this.process(node.body);
      }
      return null;
    }

    if (node instanceof ForStatementNode) {
      
      const start = this.process(node.startVal);
      const target = this.process(node.targetVal);
      const variableName = node.variableToken.value;

      let step = 1;
      if (node.step) {
        step = this.process(node.step);
      }

      if (step === 0) {
        throw new RuntimeError(node.step.token.start, node.step.token.end,
          'For loop step cannot be 0', this.context);
      }

      for (let i = start; i < target; i += step) {
        this.context.set(variableName, i);
        this.process(node.body);
      }
      return null;
    }

    if (node instanceof NumberNode) return node.token.value;
    if (node instanceof BooleanNode) return node.token.value;
    if (node instanceof StringNode) return node.token.value;
    if (node instanceof NilNode) return node.token.value;

    if (node instanceof IdentifierNode) {
      const value = this.context.get(node.token.value);
      if (exists(value)) return value;
      throw new RuntimeError(node.token.start, node.token.end, `Identifier '${node.token.asString()}' is undefined.`, this.context);
    }

    if (node instanceof FunctionDeclarationNode) {
      const func = new Function(node.name, node.body, node.args, this.context, node.start, node.end);
      return func;
    }

    if (node instanceof CallNode) {
      const args = node.args.map(e => this.process(e));
      // BUILTINS
      if (node.func instanceof IdentifierNode) {
        const funcName = node.func.token.asString();
        
        const builtin = BUILTINS.find(e => e.name === funcName);
        if (exists(builtin)) {
          return builtin.execute(node.start, node.end, this.context, ...args);
        }
      }

      const functionToCall = this.process(node.func);
      if (functionToCall instanceof Function) {
        const { output, error } = functionToCall.execute(node.start, node.end, ...args);
        if (error) throw error;
        // if (output.constructor.name === 'Array') return null;
        return output;
      } else {
        throw new RuntimeError(node.func.token.start, node.func.token.end, `'${node.func.token.value}' is not a function`, this.context);
      }
    }

    if (node instanceof ListAccessNode) {
      const list = this.process(node.list);
      const index = this.process(node.index);
      
      const start = node.start;
      const end = node.end;

      if (type(index) !== 'number') {
        throw new RuntimeError(start, end, `Index '${index}' is not a number`, this.context);
      }

      if (type(list) !== 'list' && type(list) !== 'string') {
        throw new RuntimeError(start, end, `'${node.list.token.value}' is not a list nor a string`, this.context);
      }

      if (type(list) === 'list' && list.type !== 'elements') {
        throw new RuntimeError(start, end, `'${node.list.token.value}' is not a list`, this.context);
      }
      if (index < 0 || index >= list.length) {
        throw new RuntimeError(start, end, `Index ${index} out of range for length ${list.length}`, this.context);
      }
      return list[index];
    }

    if (node instanceof UnaryOperatorNode) {

      const right = this.process(node.right);

      switch (node.token.type) {
        case TOKEN.PLUS:
          if (type(right) === 'number') {
            return right;
          }
        case TOKEN.MIN:
          if (type(right) === 'number') {
            return right * -1;
          }
        case TOKEN.NOT:
          if (type(right) === 'boolean') {
            return !right;
          }
      }
      throw new RuntimeError(node.token.start, node.token.end,
        `Invalid operator '${node.token.asString()}' for type '${type(right)}'`, this.context);
    }

    if (node instanceof BinaryOperatorNode) {

      const right = this.process(node.right);

      // FOR VARIABLE ASSIGNMENTS
      if (node.token.type === TOKEN.EQ) {

        // List assignment
        if (node.left instanceof ListAccessNode) {
          const start = node.left.start;
          const coordinates = [];
          let current = node.left;
          while (current instanceof ListAccessNode) {
            const coord = this.process(current.index);
            if (!Number.isInteger(coord)) {
              throw new RuntimeError(current.index.token.start, current.index.token.end,
                `Index '${coord}' is not an integer`, this.context);
            }
            coordinates.push(coord);
            current = current.list;
          }
          coordinates.reverse();

          if (!(current instanceof IdentifierNode)) {
            const end = current.token?.end || current.end;
            throw new InvalidSyntaxError(start, end, 'Invalid left-hand side in assignment');
          }

          const list = this.process(current);

          if (list.type !== 'elements') {
            throw new RuntimeError(current.token.start, current.token.end,
              `'${current.token.value}' is not a list`, this.context);
          }

          if (coordinates.length === 0) {
            throw new RuntimeError(current.token.start, current.token.end,
              `'${current.token.value}' is not a list`, this.context);
          }

          let currentList = list;
          for (let i = 0; i < coordinates.length - 1; i++) {
            const index = coordinates[i];
            if (index < 0 || index >= currentList.length + 1) {
              throw new RuntimeError(current.token.start, current.token.end,
                `Index ${index} out of range for length ${currentList.length}`, this.context);
            }
            const nextList = currentList[index];
            if (nextList.type !== 'elements') {
              throw new RuntimeError(current.token.start, current.token.end,
                `'${current.token.value}' is not a list`, this.context);
            }
            currentList = nextList;
          }

          const index = coordinates[coordinates.length - 1];
          if (index < 0 || index >= currentList.length + 1) {
            throw new RuntimeError(current.token.start, current.token.end,
              `Index ${index} out of range for length ${currentList.length}`, this.context);
          }

          currentList[index] = right;
          
          return right;

        }
        
        // Variable assignment
        if (node.left.token.type === TOKEN.IDENTIFIER) {

          switch (node.right.constructor) {
            case ForStatementNode:
              throw new InvalidSyntaxError(node.token.start, node.token.end,
                "Cannot assign 'for'");
            case IfStatementNode:
              throw new InvalidSyntaxError(node.token.start, node.token.end,
                "Cannot assign 'if'");
            case WhileStatementNode:
              throw new InvalidSyntaxError(node.token.start, node.token.end,
                "Cannot assign 'while'");
          }

          if (BUILTINS.some(e => e.name === node.left.token.value)) {
            throw new InvalidSyntaxError(node.left.token.start, node.left.token.end,
              `Cannot assign builtin '${node.left.token.value}'`);
          }

          this.context.set(node.left.token.value, right);

          if (right instanceof Function) {
            right.name = node.left.token.value;
          }

          return right;
        }

        throw new InvalidSyntaxError(node.left.start, node.left.end, 'Invalid left-hand side in assignment');
      }


      const left = this.process(node.left);

      if (node.token.type === TOKEN.OR) {
        if (truthy(left)) return left;
        return right;
      }

      if (node.token.type === TOKEN.AND) {
        if (truthy(left)) return right;
        return left;
      }

      // FOR PLUS/MINUS EQUAL SHORTHAND
      if (node.token.type === TOKEN.PE || node.token.type === TOKEN.ME) {
        const operator = node.token.type === TOKEN.PE ? 1 : -1;
        if (node.left.token.type !== TOKEN.IDENTIFIER) throw new InvalidSyntaxError(
          node.left.token.start, node.left.token.end, 
          'Invalid left-hand side in assignment'
        );
        
        const value = this.context.get(node.left.token.value);
        if (!exists(value)) throw new InvalidSyntaxError(
          node.left.token.start, node.left.token.end,
          `Identifier '${node.left.token.asString()}' is undefined.`
        );

        if (type(value) === 'string' && type(right) === 'string') {
          if (operator === 1) {
            this.context.set(node.left.token.value, value + right);
            return value + right;
          } else {
            throw new RuntimeError(node.token.start, node.token.end,
              `Invalid operator '${node.token.asString()}' for type 'string' and 'string'`, this.context);
          }
        }

        if (type(value) === 'number' && type(right) === 'number') {
          this.context.set(node.left.token.value, value + right * operator);
          return value + right * operator;
        } else {
          throw new RuntimeError(node.token.start, node.token.end, 
            `Invalid expression between types '${type(value)}' and '${type(right)}'`, this.context);
        }
      }
        
      // FOR STRINGS MULTIPLIED BY NUMBERS
      if (node.token.type === TOKEN.MUL) {
        if (type(left) === 'string' && type(right) === 'number') {
          return left.repeat(right);
        }
    
        if (type(left) === 'number' && type(right) === 'string') {
          return right.repeat(left);
        }
      }

      switch (node.token.type) {
        case TOKEN.EE:
          return left === right;
        case TOKEN.NE:
          return left !== right;
      }

      if (type(left) === type(right)) {
        // FOR ANY EQUAL TYPE

        if (type(left) === 'boolean') {
          // FOR BOOLEANS
          switch (node.token.type) {
            case TOKEN.AND:
              return left && right
            case TOKEN.OR:
              return left || right
          }
        } else if (type(left) === 'string') {
          // FOR STRINGS
          switch (node.token.type) {
            case TOKEN.PLUS:
              return left + right;
          }
        } else if (type(left) === 'number') {
          // FOR NUMBERS
          switch (node.token.type) {
            case TOKEN.PLUS:
              return left + right;
            case TOKEN.MIN:
              return left - right;
            case TOKEN.MUL:
              return left * right;
            case TOKEN.DIV:
              if (right === 0) throw new RuntimeError(node.token.start, node.token.end, 'Division by zero', this.context);
              return left / right;
            case TOKEN.MOD:
              if (right === 0) throw new RuntimeError(node.token.start, node.token.end, 'Modulo by zero', this.context);
              return mod(left, right);
            case TOKEN.LT:
              return left < right;
            case TOKEN.LTE:
              return left <= right;
            case TOKEN.GT:
              return left > right;
            case TOKEN.GTE:
              return left >= right;
          }
        }
        throw new RuntimeError(node.token.start, node.token.end,
          `Invalid operator '${node.token.asString()}' for type '${type(left)}'`, this.context);
      }

      throw new RuntimeError(node.token.start, node.token.end,
        `Invalid operator '${node.token.asString()}' for type '${type(left)}' and '${type(right)}'`, this.context);
    }

    throw new RuntimeError(new Position(0, 0, 0, "", ""), new Position(0, 0, 0, "", ""),
        `Invalid node type '${node}'. This should not happen.`, this.context);
  }
}

class Function {
  constructor(name, bodyNode, args, context, start, end) {
    this.name = name ?? '<anonymous>';
    this.bodyNode = bodyNode;
    this.args = args;
    this.context = context;
    this.start = start;
    this.end = end;
  }

  execute(start, end, ...args) {
    if (args.length !== this.args.length) {
      throw new RuntimeError(
        start, end,
        `${this.args.length} arguments were expected, received ${args.length}`, this.context
      )
    }

    const context = new Context(this.name, this.context, start);
    for (let i = 0; i < args.length; i++) {
      const argName = this.args[i];
      const argValue = args[i];
      context.set(argName, argValue);
    }
    const interpreter = new Interpreter(this.bodyNode, context);

    let output;
    try {
      output = interpreter.evaluate();
    } catch (e) {
      return {
        error: e,
        output: null
      }
    }
    
    return {
      output,
      error: null
    }
  }
}
Function.prototype.toString = function() {
  return `[function ${this.name}]`;
}

class Context {
	constructor(displayName, parent = null, pos = null) {
		this.displayName = displayName
		this.parent = parent
    this.pos = pos;
    this.symbols = {};
  }
  get(name) {
    const value = this.symbols[name];
    if (!exists(value) && exists(this.parent)) {
      return this.parent.get(name);
    }
    return value;
  }
  set(name, value) {
    this.symbols[name] = value;
  }
  remove(name) {
    this.symbols[name] = undefined;
  }
}

/*** 
 * BinaryOperator
 * UnaryOperator
 * Identifier
 * FunctionDeclaration
 * Return
 * Call
 * IfStatement
 * ForStatement
 * Number
 * Boolean
 * String
 * Nil
 * List
*/
class Node {
  constructor(left, token, right) {
    this.left = left;
    this.token = token;
    this.right = right;
  }

  stringRepresentation() {
    if (this instanceof NumberNode) return `(${this.token.asString()})`;
    if (this instanceof UnaryOperatorNode) return `(${this.token.asString()}${this.right.stringRepresentation()})`;
    return `(${this.left.stringRepresentation()}${this.token.asString()}${this.right.stringRepresentation()})`
  }
}
class BinaryOperatorNode extends Node {
  constructor(left, operatorToken, right) {
    super(left, operatorToken, right);
  }
}
class UnaryOperatorNode extends Node {
  constructor(operatorToken, right) {
    super(null, operatorToken, right);
  }
}
class IdentifierNode extends Node {
  constructor(token) {
    super(null, token, null);
  }
}
class FunctionDeclarationNode extends Node {
  constructor(name, args, body, token, start, end) {
    super();
    this.name = name;
    this.args = args;
    this.body = body;
    this.token = token;
    this.start = start;
    this.end = end;
  }
}
class ReturnNode extends Node {
  constructor(expr, start, end) {
    super();
    this.expr = expr;
    this.start = start;
    this.end = end;
  }
}
class CallNode extends Node {
  constructor(func, args, start, end) {
    super();
    this.args = args;
    this.func = func;
    this.start = start;
    this.end = end;
  }
}
class ListAccessNode extends Node {
  constructor(list, index, start, end) {
    super();
    this.list = list;
    this.index = index;
    this.start = start;
    this.end = end;
  }
}
class IfStatementNode extends Node {
  constructor(clauses) {
    super();
    this.clauses = clauses;
  }
}
class ForStatementNode extends Node {
  constructor(variableToken, startVal, targetVal, step, body) {
    super();
    this.variableToken = variableToken;
    this.startVal = startVal;
    this.targetVal = targetVal;
    this.step = step;
    this.body = body;
  }
}
class WhileStatementNode extends Node {
  constructor(condition, body) {
    super();
    this.condition = condition;
    this.body = body;
  }
}
class NumberNode extends Node {
  constructor(token) {
    super(null, token, null);
  }
}
class BooleanNode extends Node {
  constructor(token) {
    super(null, token, null);
  }
}
class StringNode extends Node {
  constructor(token) {
    super(null, token, null);
  }
}
class NilNode extends Node {
  constructor(token) {
    super(null, token, null)
  }
}
class StatementNode extends Node {
  constructor(statements, start, end) {
    super();
    this.statements = statements;
    this.start = start;
    this.end = end;
  }
}
class ListNode extends Node {
  constructor(elements, start, end) {
    super();
    this.elements = elements;
    this.start = start;
    this.end = end;
  }
}

const context = new Context('<program>', null, new Position(0, 0, 0, '<program>', ''));

context.set('PI', 3.1415926)
context.set('e', 2.7182818);

class Builtin {
  constructor(name, func, argsNumber, context) {
    this.name = name;
    this.func = func;
    this.argsNumber = argsNumber;
    this.context = context;
  }

  execute(start, end, context, ...args) {

    this.context = context;

    this.start = start;
    this.end = end;

    if (this.argsNumber.constructor.name === 'Array') {
      if (!this.argsNumber.includes(args.length)) {
        const txt = this.argsNumber.map((e, i) => {
          if (i === this.argsNumber.length - 1) return ` or ${e}`;
          if (i === 0) return `${e}`;
          return `, ${e}`;
        }).join('')
        throw new RuntimeError(
          start, end,
          `${txt} argument${this.argsNumber[this.argsNumber.length - 1] === 1 ? ' was' : 's were'} expected, received ${args.length}`, this.context
        );
      }
    } else if (this.argsNumber.constructor.name === 'Object') {
      if (this.argsNumber.max === -1) {
        if (args.length < this.argsNumber.min) {
          throw new RuntimeError(
            start, end,
            `${this.argsNumber.min} or more arguments were expected, received ${args.length}`, this.context
          );
        }
      } else {
        if (args.length < this.argsNumber.min || args.length > this.argsNumber.max) {
          throw new RuntimeError(
            start, end,
            `Between ${this.argsNumber.min} and ${this.argsNumber.max} arguments were expected, received ${args.length}`, this.context
          );
        }
      }
    } else {
      if (this.argsNumber !== -1 && args.length !== this.argsNumber) {
        throw new RuntimeError(
          start, end,
          `${this.argsNumber} arguments were expected, received ${args.length}`, this.context
        )
      }
    }

    return this.func(...args);
  }
}

const BUILTINS = [
  new Builtin('print', function(...e) {
    console.log(...(e.map(formatOutput)));
    return null;
  }, {
    min: 1,
    max: -1
  }),
  new Builtin('input', function(e) {
    return prompt(e);
  }, {
    min: 0,
    max: 1
  }, context),
  new Builtin('str', function(e) {
    return e.toString();
  }, 1),
  new Builtin('num', function(e) {
    const num = parseFloat(e);
    if (!isNaN(num)) {
      return num;
    } else {
      throw new RuntimeError(this.start, this.end,
        `Invalid number '${formatOutput(e)}'`);
    }
  }, 1),
  new Builtin('type', function(e) {
    return type(e);
  }, 1),
  new Builtin('sqrt', function(e) {
    return Math.sqrt(e);
  }, 1),
  new Builtin('floor', function(e) {
    return Math.floor(e);
  }, 1),
  new Builtin('len', function(e) {
    if (e?.constructor.name === 'String') return e.length;
    if (e?.constructor.name === 'Array') return e.length;
    throw new RuntimeError(this.start, this.end,
      `Cannot get length of '${formatOutput(e)}'`, this.context);
  }, 1),
  new Builtin('min', function(a, b) {
    if (a?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot get minimum of '${formatOutput(a)}'`, this.context);
    }
    if (b?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot get minimum of '${formatOutput(b)}'`, this.context);
    }
    return Math.min(a, b);
  }, 2),
  new Builtin('max', function(a, b) {
    if (a?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot get maximum of '${formatOutput(a)}'`, this.context);
    }
    if (b?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot get maximum of '${formatOutput(b)}'`, this.context);
    }
    return Math.max(a, b);
  }, 2),
  new Builtin('rand', function() {
    return Math.random();
  }, 0),
  new Builtin('abs', function(e) {
    if (e?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot get absolute value of '${formatOutput(e)}'`, this.context);
    }
    return Math.abs(e);
  }, 1),
  new Builtin('sleep', function(ms) {
    if (ms?.constructor.name !== 'Number') {
      throw new RuntimeError(this.start, this.end,
        `Cannot sleep for '${formatOutput(ms)}' ms`, this.context);
    }
    sleep(ms);
    return null;
  }, 1),
  new Builtin('fetch', function(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    return xhr.responseText;
  }, 1),
  new Builtin('load', function(file) {
    let code;
    try {
      code = readFileSync(file, 'utf8');
    } catch(e) {
      throw new RuntimeError(this.start, this.end,
        `Could not read file: '${file}'`, this.context);
    }

    const tokenizer = new Tokenizer(code, file);
    let tokens = tokenizer.tokenize();

    const parser = new Parser(tokens);
    let tree = parser.parse();

    const interpreter = new Interpreter(tree, context);
    let output = interpreter.evaluate();

    return null;
  }, 1)
]

function evaluate(fileName, input) {
  const tokenizer = new Tokenizer(input, fileName);
  let tokens;
  try {
    tokens = tokenizer.tokenize();
  } catch (e) {
    return {
      error: formatOutput(e)
    }
  }
  
  // return { output: tokens };

  const parser = new Parser(tokens);
  let tree
  try {
    tree = parser.parse();
  } catch (e) {
    return {
      error: formatOutput(e)
    }
  }

  // console.log(JSON.stringify(tree.statements, null, 2));
  // return { output: tree.statements };

  const interpreter = new Interpreter(tree, context);
  let output 
  try {
    output = interpreter.evaluate();
  } catch (e) {
    return {
      error: formatOutput(e)
    }
  }

  return {
    output: formatOutput(output)
  }
}

function formatOutput(e) {
  if (e instanceof OsklangError) {
    let str = e.lineText + '\n';
    let repeatCount = e.end.column - e.start.column;
    if (repeatCount < 1) repeatCount = 1;
    str += ' '.repeat(e.start.column) + '^'.repeat(repeatCount) + '\n';
    str += e.toString();
    return str;
  }
  if (e instanceof Error) return e;
  if (e === null) return 'nil';
  if (e instanceof Array) {

    if (e.type === 'statements') {
      const last = e[e.length - 1];
      if (!exists(last)) return formatOutput(null);
      return formatOutput(last);
    }

    return '[' + e.map(formatOutput).join(', ') + ']';

  }
  if (type(e) === 'string') {
    return `${e.replace(/'/g, "\\'")}`;
  }
  return e.toString();
}

export default {
  evaluate
}