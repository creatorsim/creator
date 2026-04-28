#
# WepSIM (https://wepsim.github.io/wepsim/)
#

.text
main:
           # loop initialization
           lui t1,  0
           lui t2,  5
           lui t3,  1
           # loop header
    loop1: beq t1, t2, fin1
           # loop body
           add t1, t1, t3
           beq t0, t0, loop1

     fin1: jalr x0, 0(ra)

