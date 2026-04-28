.data
	console_ctrl_addr: .word 0xF0000000
    console_data_addr: .word 0xF0000008
    string1: .string "Insert the string length (no more than 100 characters) "
    string2: .string "Insert the string "
    space: .zero 100


.text

	main:
        # load console data addr to t0
        la t0, console_data_addr
        lw t0, 0(t0)

        # load console ctrl addr to t1
        la t1, console_ctrl_addr
        lw t1, 0(t1)


        # print "Insert string length..."
        la t2, string1
        sw t2, 0(t0)  # store value in console data
        li t2, 4
        sw t2, 0(t1)  # signal device to write a string

        # read int
        li t2, 5
        sw t2, 0(t1)
        lw t3, 0(t0)  # t3: length

        # print "Insert string..."
        la t2, string2
        sw t2, 0(t0)
        li t2, 4
        sw t2, 0(t1)  # signal device

        # read string
        la t2, space
        sw t2, 0(t0)  # store addr
        sw t3, 4(t0)  # store lenght
        li t2, 8
        sw t2, 0(t1)  # signal device


        # print string
        la t2, space
        sw t2, 0(t0)  # store value in console data
        li t2, 4
        sw t2, 0(t1)  # signal device to write a string

        # return
        li a7, 10
        ecall
