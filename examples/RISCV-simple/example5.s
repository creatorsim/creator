#
# WepSIM (https://wepsim.github.io/wepsim/)
#

.data

   matrix: .word 1, 0, 3, 0, 0, 1
           .word 1, 2, 0, 1, 1, 0

.text

counting:
       # result = 0
       add  t5, a0, x0
       lui  a0, 0

       # for (t0=0; t0 < a1; ...
       lui  t0, 0
   b1: bge  t0, a1, f1

       # for (t1=0; t1 < a2; ...
       lui  t1, 0
   b2: bge  t1, a2, f2

       # t2 = (t0*a2 + t1) * 4
       mul  t2, t0, a2
       add  t2, t2, t1
       lui  t3, 4
       mul  t2, t2, t3

       # elto = *( t5 + t2 ) 
       add  t2, t5, t2
       lw   t2, 0(t2)

       bne  t2, x0, nozero
       lui  t3, 1
       add  a0, a0, t3
nozero: 

       # ... t1++) 
       lui  t3, 1
       add  t1, t1, t3
       beq  x0, x0, b2

f2:
       # ... t0++) 
       lui  t3, 1
       add  t0, t0, t3
       beq  x0, x0, b1

f1:
       # return
       jalr x0, 0(ra)


main: 
       # counting (matrix, 2, 6)
       li a0, matrix
       li a1, 2
       li a2, 6
       addi sp, sp, -4
       sw ra, 0(sp)
       jal ra, counting
       lw ra, 0(sp)
       addi sp, sp, 4
       jr ra

