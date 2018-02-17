'use strict';
/* global describe it beforeEach */

const assert = require('assert');

const IR = require('../');
const Serializer = require('../lib/llvm/').Serializer;

describe('IR/Serializer', () => {
  let ir;
  let s;
  beforeEach(() => {
    ir = new IR();
    s = new Serializer();
  });

  it('should serialize string', () => {
    const str = ir.cstr('hello');

    const use = ir._('something', [ str.type, str ]);
    assert.strictEqual(s.instruction(use),
      '%i0 = something [6 x i8]* @.cstr0');

    assert.strictEqual(ir.build(),
      '@.cstr0 = private unnamed_addr constant [6 x i8] c"hello\\00"\n');
  });

  it('should serialize raw string in instruction', () => {
    const i8 = ir.i(8);

    const ref = i8.ref('s');
    const bitcast =
      ir._('bitcast', [ ref.type, ref, 'to', ir.i(16).ptr() ]);
    assert.strictEqual(s.instruction(bitcast), '%i0 = bitcast i8* @s to i16*');
  });

  it('should serialize struct', () => {
    const state = ir.struct('state');

    state.field(ir.i(32), 'hello');
    state.field(ir.i(8).ptr(), 'world');

    assert.strictEqual(s.struct(state), [
      '%state = type {',
      '  i32, ; 0 => "hello"',
      '  i8* ; 1 => "world"',
      '}'
    ].join('\n'));
  });

  it('should serialize declaration', () => {
    const i32 = ir.i(32);
    const sig = ir.signature(i32, [ i32, i32 ]);

    const decl = ir.declare(sig, 'ext');
    decl.attributes = 'nounwind';

    assert.strictEqual(s.declaration(decl),
      'declare i32 @ext(i32, i32) nounwind');
  });

  it('should serialize function', () => {
    const i32 = ir.i(32);
    const sig = ir.signature(i32, [ i32 ]);
    const fn = ir.fn(sig, 'fn', [ 'p' ]);

    fn.visibility = 'internal';
    fn.attributes = 'alwaysinline';

    const add = ir._('add', [ i32, i32.v(1) ], fn.arg('p'));
    const add2 = ir._('add', [ i32, add ], add);

    fn.body.push([ add, add2 ]);

    const ref = i32.ref('global_int');
    const targets = fn.body.terminate('br', [ ref.type, ref ],
      ir.label('left'), ir.label('right'));

    targets[0].push(ir.comment('return'));
    targets[0].terminate('ret', [ i32, add2 ]);

    targets[1].push(ir.comment('return'));
    targets[1].terminate('ret', [ i32, add ]);

    assert.strictEqual(s.function(fn), [
      'define internal i32 @fn(i32 %p) alwaysinline {',
      '  %i0 = add i32 1, %p',
      '  %i1 = add i32 %i0, %i0',
      '  br i32* @global_int, label %b0_left, label %b1_right',
      'b0_left:',
      '  ; return',
      '  ret i32 %i1',
      'b1_right:',
      '  ; return',
      '  ret i32 %i0',
      '}'
    ].join('\n'));
  });
});
