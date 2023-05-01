import osklang from "./osklang_simple.js";
import assert from 'assert';

console.log(`Using okslang_simple`);

assert.strictEqual(evaluate('1'), '1');
assert.strictEqual(evaluate('-3'), '-3');
assert.strictEqual(evaluate('-- foo'), 'nil');
assert.strictEqual(evaluate('3.25'), '3.25');
assert.strictEqual(evaluate('3.25/2.5'), '1.3');
assert.strictEqual(evaluate('3.25-2.5'), '0.75');
assert.strictEqual(evaluate('!false'), 'true');
assert.strictEqual(evaluate('!false && true'), 'true');
assert.strictEqual(evaluate('false || true'), 'true');
assert.strictEqual(evaluate('10 == 11'), 'false');
assert.strictEqual(evaluate('10 > 11'), 'false');
assert.strictEqual(evaluate('-12+4 >= -8'), 'true');
assert.strictEqual(evaluate('-12+4 < -7'), 'true');
assert.strictEqual(evaluate('3.25*-2'), '-6.5');
assert.strictEqual(evaluate('PI*2'), '6.2831852');
assert.strictEqual(evaluate('4+2'), '6');
assert.strictEqual(evaluate('-3%4'), '1');
assert.strictEqual(evaluate('7%5'), '2');
assert.strictEqual(evaluate('x = 10'), '10');
assert.strictEqual(evaluate('x/2'), '5');
assert.strictEqual(evaluate('x = y = 2'), '2');
assert.strictEqual(evaluate('10 + y'), '12');
assert.strictEqual(evaluate('5/(foo = 2)'), '2.5');
assert.strictEqual(evaluate('-12+2'), '-10');
assert.strictEqual(evaluate('-12*2'), '-24');
assert.strictEqual(evaluate('4*2+2'), '10');
assert.strictEqual(evaluate('4*(2+2)'), '16');
assert.strictEqual(evaluate('1+2+3+4/2*3'), '12');
assert.strictEqual(evaluate('120/2+4*2+1'), '69');
assert.strictEqual(evaluate('-(120/2+4*2+1)'), '-69');
assert.strictEqual(evaluate('-(120/(2+4)*2+1)'), '-41');
assert.strictEqual(evaluate('120/-(7%5)*5+8/4'), '-298');

assert.strictEqual(evaluate('list = [1, 2, 3]'), '[1, 2, 3]');
assert.strictEqual(evaluate('list[0]'), '1');
assert.strictEqual(evaluate('list[1]'), '2');
assert.strictEqual(evaluate('list[2]'), '3');

assert.match(evaluate('list[3]'), /Index [0-9]+? out of range/);
assert.match(evaluate('list[-1]'), /Index [\-0-9]+? out of range/);

assert.strictEqual(evaluate('list[0] = 10'), '10');
assert.strictEqual(evaluate('list[0]'), '10');

assert.strictEqual(evaluate('add = function(a,b) => a+b'), '[function add]');
assert.strictEqual(evaluate('add(1,2)'), '3');
assert.match(evaluate('add(1)'), /2 arguments were expected, received 1/);
assert.match(evaluate('add(1,2,3)'), /2 arguments were expected, received 3/);

assert.strictEqual(evaluate('join = function(a,b) => [a,b]'), '[function join]');
assert.strictEqual(evaluate('join(1,2)[0]'), '1');
assert.strictEqual(evaluate('list = [add, join]'), '[[function add], [function join]]');
assert.strictEqual(evaluate('list[0](1,2)'), '3');
assert.strictEqual(evaluate('join(list,1)[0][1](1,7)[1]'), '7');
assert.strictEqual(evaluate('list[1](1,9)[1]'), '9');

assert.strictEqual(evaluate('deep = [1,2,3,[4,5,6]]'), '[1, 2, 3, [4, 5, 6]]');
assert.strictEqual(evaluate('deep[3][0] = 10'), '10');
assert.strictEqual(evaluate('deep'), '[1, 2, 3, [10, 5, 6]]');
assert.strictEqual(evaluate('deep[3][0] = [10,11,12]'), '[10, 11, 12]');
assert.strictEqual(evaluate('deep'), '[1, 2, 3, [[10, 11, 12], 5, 6]]');
assert.strictEqual(evaluate('ref = deep[3]'), '[[10, 11, 12], 5, 6]');
assert.strictEqual(evaluate('ref[0][0] = 13'), '13');
assert.strictEqual(evaluate('deep'), '[1, 2, 3, [[13, 11, 12], 5, 6]]');

assert.strictEqual(evaluate('load("examples/gcd.osk")'), 'nil');
assert.strictEqual(evaluate('gcd(10, 5)'), '5');

console.log('All tests passed successfully');

function evaluate(string) {
  const { output, error } = osklang.evaluate('<stdin>', string, 0);
    
  if (error) {
    return error;
  }
    
  return output;
}