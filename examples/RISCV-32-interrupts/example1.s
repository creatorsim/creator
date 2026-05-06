#
# Creator (https://creatorsim.github.io/creator/)
#

.data

.text
   rti:
      # ...

      # return from interrupt
      mret

   main:
      # enable interrupts (MIE=1)
      csrrw zero, mstatus, t0
      ori t0, t0, 8
      csrrw zero, mstatus, t0

      # enable software interrupts (MSIE=1)
      csrrw zero, mie, t0
      ori t0, t0, 8
      csrrw zero, mie, t0

      # load rti addr to mtvec
      la t0, rti
      csrrw zero, mtvec, t0

      # generate interrupt
      ecall

      li t0, 0
      jr ra
