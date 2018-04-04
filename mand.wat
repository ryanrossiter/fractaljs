(module
  (memory (import "js" "mem") 1)
  (func $mand (param $x f64) (param $y f64) (param $incr i32) (result i32)
    (local $ox f64)
    (local $oy f64)
    (local $t2x f64)
    (local $i i32)
    (set_local $ox (get_local $x))
    (set_local $oy (get_local $y))
    (set_local $i (i32.const 0))
    (block $stop
      (loop $loop
        (set_local $t2x (f64.mul (get_local $x) (f64.const 2)))
        (set_local $x (f64.add (f64.sub (f64.mul (get_local $x) (get_local $x)) (f64.mul (get_local $y) (get_local $y))) (get_local $ox)))
        (set_local $y (f64.add (f64.mul (get_local $t2x) (get_local $y)) (get_local $oy)))
        (br_if $stop (f64.gt (f64.mul (get_local $x) (get_local $y)) (f64.const 10)))
        (set_local $i (i32.add (get_local $i) (i32.const 1)))
        (br_if $loop (i32.lt_u (get_local $i) (get_local $incr)))
      )
    )
    (return (get_local $i))
  )
  (func $mandTex (param $w i32) (param $h i32) (param $incr i32) (param $zoom f64) (param $xOff f64) (param $yOff f64)
    (local $pos i32)
    (local $xp f64)
    (local $yp f64)
    (local $r i32)
    (local $c f32)
    (local $ow i32)
    (local $oh i32)
    (set_local $ow (get_local $w))
    (set_local $oh (get_local $h))
    (set_local $h (i32.sub (get_local $h) (i32.const 1)))
    (loop $hLoop
      (set_local $w (i32.sub (get_local $ow) (i32.const 1)))
      (loop $wLoop
        (set_local $xp
          (f64.add
            (f64.mul
              (f64.sub
                (f64.div (f64.convert_u/i32 (get_local $w)) (f64.convert_u/i32 (get_local $ow)))
                (f64.const 0.5))
              (get_local $zoom))
            (f64.div (get_local $xOff) (f64.convert_u/i32 (get_local $ow)))))
        (set_local $yp
          (f64.add
            (f64.mul
              (f64.sub
                (f64.div (f64.convert_u/i32 (get_local $h)) (f64.convert_u/i32 (get_local $ow)))
                (f64.mul
                  (f64.const 0.5)
                  (f64.div (f64.convert_u/i32 (get_local $oh)) (f64.convert_u/i32 (get_local $ow)))))
              (get_local $zoom))
            (f64.div (get_local $yOff) (f64.convert_u/i32 (get_local $ow)))))
        
        (set_local $r (call $mand (get_local $xp) (get_local $yp) (get_local $incr)))
        (block $skip
          (br_if $skip (i32.eq (get_local $r) (get_local $incr)))
          (set_local $c (f32.mul (f32.div (f32.convert_u/i32 (get_local $r)) (f32.convert_u/i32 (get_local $incr))) (f32.const 255)))
          (set_local $pos (i32.mul (i32.add (get_local $w) (i32.mul (get_local $h) (get_local $ow))) (i32.const 3)))
          (i32.store8 (get_local $pos) (i32.trunc_u/f32 (f32.mul (f32.const 2.5) (get_local $c))))
          (i32.store8 (i32.add (i32.const 1) (get_local $pos)) (i32.trunc_u/f32 (f32.mul (f32.const 4.0) (get_local $c))))
          (i32.store8 (i32.add (i32.const 2) (get_local $pos)) (i32.trunc_u/f32 (f32.mul (f32.const 0.5) (get_local $c))))
        )
        (set_local $w (i32.sub (get_local $w) (i32.const 1)))
        (br_if $wLoop (i32.ge_s (get_local $w) (i32.const 0)))
      )
      (set_local $h (i32.sub (get_local $h) (i32.const 1)))
      (br_if $hLoop (i32.ge_s (get_local $h) (i32.const 0)))
    )
  )
  (export "mand" (func $mand))
  (export "mandTex" (func $mandTex))
)