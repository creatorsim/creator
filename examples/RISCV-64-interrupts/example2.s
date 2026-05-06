.data
	console_ctrl_addr: .word   0xF0000000
    console_data_addr: .word   0xF0000008

.text

rti:   			# load mcause to t0
                csrrw t0, mcause, t0
                csrrw t1, mscratch, t1  # swap t1 w/ mscratch

                # treat interruption

                # if ecall
                li t1, 256
				beq t0, t1, rti_ecall

rti_ecall:      li t1, 1
				beq a7, t1, rti_print_int

rti_print_int:  # load console data addr to t0
        		la t0, console_data_addr
        		lw t0, 0(t0)
        		# load console ctrl addr to t1
        		la t1, console_ctrl_addr
        		lw t1, 0(t1)

        		sw a0, 0(t0)  # store value in console data

        		li t0, 1
        		sw t0, 0(t1)  # signal device to write an integer
				j rti_end

rti_end:		csrrw t0, mcause, t0  # restore t0
				csrrw t1, mscratch, t1  # restore t1
				mret


main:  			li a7, 1
				li a0, 69
				ecall
                jr ra
