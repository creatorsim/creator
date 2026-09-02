<!--
Copyright 2018-2026 CREATOR Team.

This file is part of CREATOR.

CREATOR is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

CREATOR is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with CREATOR.  If not, see <http://www.gnu.org/licenses/>.
-->
<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { Memory } from "@/core/memory/Memory.mjs";
import type { Device } from "@/core/executor/DeviceManager.mjs";
import { coreEvents } from "../../../core/events.mts";
import {
  stackTracker,
  architecture,
  getPC,
  PC_REG_INDEX,
  getSP,
  SP_REG_INDEX,
} from "@/core/core.mjs";
import type { StackFrame } from "@/core/memory/StackTracker.mjs";
import type { MemoryBackup } from "@/core/memory/Memory.mts";
import MemoryLayoutDiagram from "../architecture/memory_layout/MemoryLayoutDiagram.vue";
import { decode } from "@/core/executor/decoder.mjs";
import { MAXNWORDS } from "@/core/utils/architectureProcessor.mjs";
import { instructions } from "@/core/assembler/assembler.mjs";

export default defineComponent({
  props: {
    main_memory: { type: Object as PropType<Memory>, required: true },
    devices: { type: Map as PropType<Map<string, Device>>, required: true },
    segment: { type: String, required: true },
  },

  components: {
    MemoryLayoutDiagram,
  },

  data() {
    return {
      memoryDump: null as MemoryBackup | null,
      pc: -1,
      sp: -1,
      bytesPerRow: 8,
      showAscii: window.innerWidth >= 1220,
      showAddresses: true,
      selectedByte: -1,
      viewMode: "hex" as "hex" | "ascii",
      hintMap: new Map<
        number,
        { tag: string; type: string; sizeInBits?: number; colorIndex: number }
      >(),
      hintTooltip: null as HTMLElement | null,
      showAllTags: true,

      memorySegments: this.main_memory.getMemorySegments(),
      deviceIDs: Array.from(this.devices.keys()),

      // Rendering state
      renderState: {} as any,

      // Pagination
      rowHeight: 24,
      rowsPerPage: 100, // Number of rows per page
      currentPage: 0, // Current page number (0-indexed)
      pageScrollTop: 0, // Scroll position within the current page

      // Window width tracking
      windowWidth: window.innerWidth,

      // Editing state
      editingByte: -1,
      editingValue: "",

      // Memory layout modal
      showMemoryLayoutModal: false,
      architecture,
      invertMemoryLayout: true,
    };
  },

  mounted() {
    // Calculate initial bytes per row and ASCII visibility based on window width
    this.updateBytesPerRow();
    this.updateAsciiVisibility();

    this.updatePC();
    this.updateSP();
    this.refreshMemory();

    // Subscribe to register update events
    coreEvents.on("register-updated", this.onRegisterUpdated);

    // Setup resize handler
    window.addEventListener("resize", this.handleResize);
  },

  beforeUnmount() {
    coreEvents.off("register-updated", this.onRegisterUpdated);

    window.removeEventListener("resize", this.handleResize);

    this.hideHintTooltip();
  },

  computed: {
    totalRows(): number {
      if (!this.memoryDump || this.memoryDump.highestAddress === 0) return 0;
      return Math.ceil((this.memoryDump.highestAddress + 1) / this.bytesPerRow);
    },

    totalPages(): number {
      return Math.ceil(this.totalRows / this.rowsPerPage);
    },

    hexColumnsHeader(): string[] {
      const headers = [];
      for (let i = 0; i < this.bytesPerRow; i++) {
        headers.push(i.toString(16).toUpperCase().padStart(2, "0"));
      }
      return headers;
    },

    // Get visible rows for the current page only
    visibleRows(): number[] {
      const startRow = this.currentPage * this.rowsPerPage;
      const endRow = Math.min(startRow + this.rowsPerPage, this.totalRows);
      const rows: number[] = [];

      for (let row = startRow; row < endRow; row++) {
        rows.push(row);
      }

      return rows;
    },

    selectionInfo(): string {
      if (this.selectedByte < 0 || !this.memoryDump) return "";

      const address = this.selectedByte;
      const value = this.getMemoryValue(address);
      const char =
        value >= 32 && value <= 126 ? String.fromCharCode(value) : ".";

      let info = `Address: 0x${address.toString(16).toUpperCase().padStart(8, "0")}`;

      if (this.viewMode === "hex") {
        info += ` | Value: 0x${value.toString(16).toUpperCase().padStart(2, "0")} (${value}) | ASCII: '${char}'`;
      } else {
        info += ` | ASCII: '${char}' | Value: 0x${value.toString(16).toUpperCase().padStart(2, "0")} (${value})`;
      }

      const hintInfo = this.hintMap.get(address);
      if (hintInfo) {
        info += ` | Hint: ${hintInfo.tag}${hintInfo.type ? ` (${hintInfo.type})` : ""}`;
      }

      return info;
    },

    segmentList(): Array<{ name: string; start: bigint }> {
      return Array.from(this.memorySegments.entries()).map(
        ([name, segment]) => ({
          name,
          start: segment.start,
        }),
      );
    },

    hasPreviousPage(): boolean {
      return this.currentPage > 0;
    },

    hasNextPage(): boolean {
      return this.currentPage < this.totalPages - 1;
    },

    stackFrames(): StackFrame[] {
      return stackTracker.getAllFrames();
    },

    stackTop(): number | undefined {
      return stackTracker.getCurrentFrame()?.end;
    },

    stackBottom(): number | undefined {
      return stackTracker.getAllFrames().at(0)?.begin;
    },

    // Group tags by row for efficient rendering
    // eslint-disable-next-line max-lines-per-function
    tagsByRow(): Map<
      number,
      Array<
        Array<{
          startCol: number;
          endCol: number;
          tag: string;
          colorIndex: number;
          isStackFrame?: boolean;
          frameIndex?: number;
        }>
      >
    > {
      const tagsByRow = new Map<
        number,
        Array<
          Array<{
            startCol: number;
            endCol: number;
            tag: string;
            colorIndex: number;
            isStackFrame?: boolean;
            frameIndex?: number;
          }>
        >
      >();

      if (!this.memoryDump) return tagsByRow;

      // Temporary storage: row -> flat list of tags
      const flatTagsByRow = new Map<
        number,
        Array<{
          startCol: number;
          endCol: number;
          tag: string;
          colorIndex: number;
          isStackFrame?: boolean;
          frameIndex?: number;
        }>
      >();

      // Add memory hint tags if showAllTags is enabled
      if (this.showAllTags) {
        // Track which addresses we've already processed to avoid duplicates
        const processedTags = new Map<
          string,
          { address: number; sizeInBytes: number }
        >();

        // First pass: collect unique tags
        for (const hint of this.memoryDump.hints) {
          const address = parseInt(hint.address, 10);
          const tagKey = `${address}:${hint.tag}`;

          if (!processedTags.has(tagKey)) {
            const sizeInBytes = hint.sizeInBits
              ? Math.ceil(hint.sizeInBits / 8)
              : 1;
            processedTags.set(tagKey, { address, sizeInBytes });
          }
        }

        // Second pass: organize by row
        for (const [
          tagKey,
          { address, sizeInBytes },
        ] of processedTags.entries()) {
          const tagName = tagKey.split(":")[1] || "";
          const hintInfo = this.hintMap.get(address);
          if (!hintInfo) continue;

          const startRow = Math.floor(address / this.bytesPerRow);
          const startCol = address % this.bytesPerRow;
          const endAddress = address + sizeInBytes - 1;
          const endRow = Math.floor(endAddress / this.bytesPerRow);
          const endCol = endAddress % this.bytesPerRow;

          // Handle tags that span multiple rows
          for (let row = startRow; row <= endRow; row++) {
            if (!flatTagsByRow.has(row)) {
              flatTagsByRow.set(row, []);
            }

            const rowTags = flatTagsByRow.get(row)!;
            const rowStartCol = row === startRow ? startCol : 0;
            const rowEndCol = row === endRow ? endCol : this.bytesPerRow - 1;

            rowTags.push({
              startCol: rowStartCol,
              endCol: rowEndCol,
              tag: row === startRow ? tagName : "", // Only show tag on first row
              colorIndex: hintInfo.colorIndex,
            });
          }
        }
      }

      // Always add stack frame information
      if (
        this.stackFrames.length > 0 &&
        this.stackTop !== undefined &&
        this.stackBottom !== undefined
      ) {
        const frames = this.stackFrames.toReversed();

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]!;
          // Frame range is [end, begin) - end is inclusive, begin is exclusive
          const startAddress = frame.end;
          const endAddress = frame.begin - 1; // Make begin exclusive by subtracting 1

          // Skip if the range is invalid (empty)
          if (startAddress > endAddress) continue;

          const startRow = Math.floor(startAddress / this.bytesPerRow);
          const startCol = startAddress % this.bytesPerRow;
          const endRow = Math.floor(endAddress / this.bytesPerRow);
          const endCol = endAddress % this.bytesPerRow;

          // Handle frames that span multiple rows
          for (let row = startRow; row <= endRow; row++) {
            if (!flatTagsByRow.has(row)) {
              flatTagsByRow.set(row, []);
            }

            const rowTags = flatTagsByRow.get(row)!;
            const rowStartCol = row === startRow ? startCol : 0;
            const rowEndCol = row === endRow ? endCol : this.bytesPerRow - 1;

            // Determine label prefix based on frame index
            let frameLabel = "";
            if (row === startRow) {
              if (i === 0) {
                frameLabel = `Callee: ${frame.name}`;
              } else if (i === 1) {
                frameLabel = `Caller: ${frame.name}`;
              } else {
                frameLabel = frame.name;
              }
            }

            rowTags.push({
              startCol: rowStartCol,
              endCol: rowEndCol,
              tag: frameLabel,
              colorIndex: -1, // Special color for stack frames
              isStackFrame: true,
              frameIndex: i,
            });
          }
        }
      }

      // Always add stack hints (register hints for stack addresses)
      const stackHints = stackTracker.getAllHints();
      for (const [address, hintName] of stackHints.entries()) {
        const row = Math.floor(address / this.bytesPerRow);
        const col = address % this.bytesPerRow;

        if (!flatTagsByRow.has(row)) {
          flatTagsByRow.set(row, []);
        }

        flatTagsByRow.get(row)!.push({
          startCol: col,
          endCol: col + 3, // Stack hints typically span 4 bytes (a word)
          tag: hintName,
          colorIndex: -2, // Special color for stack hints (different from frames)
          isStackFrame: false,
        });
      }

      // Organize tags into levels to avoid overlaps
      // Hierarchy: stack frames (top) -> memory hints (middle) -> stack hints (bottom)
      for (const [row, tags] of flatTagsByRow.entries()) {
        const levels: Array<
          Array<{
            startCol: number;
            endCol: number;
            tag: string;
            colorIndex: number;
            isStackFrame?: boolean;
            frameIndex?: number;
          }>
        > = [];

        // Sort tags by priority (stack frames first, then memory hints, then stack hints)
        // Within each priority, sort by start column
        tags.sort((a, b) => {
          // Determine priority: 0 = stack frames, 1 = memory hints, 2 = stack hints
          const getPriority = (tag: typeof a) => {
            if (tag.isStackFrame) return 0;
            if (tag.colorIndex === -2) return 2; // stack hints
            return 1; // memory hints
          };

          const priorityDiff = getPriority(a) - getPriority(b);
          if (priorityDiff !== 0) return priorityDiff;

          // Same priority, sort by start column
          return a.startCol - b.startCol;
        });

        for (const tag of tags) {
          // Find the first level where this tag doesn't overlap with existing tags
          let placed = false;
          for (const level of levels) {
            const hasOverlap = level.some(
              existingTag =>
                !(
                  tag.endCol < existingTag.startCol ||
                  tag.startCol > existingTag.endCol
                ),
            );

            if (!hasOverlap) {
              level.push(tag);
              placed = true;
              break;
            }
          }

          // If no suitable level found, create a new one
          if (!placed) {
            levels.push([tag]);
          }
        }

        tagsByRow.set(row, levels);
      }

      return tagsByRow;
    },
  },

  watch: {
    segment() {
      this.refreshMemory();
    },

    bytesPerRow() {
      this.refreshMemory();
    },
  },

  methods: {
    onRegisterUpdated() {
      // Refresh memory when registers change (e.g., SP, PC)
      // This will also trigger a re-computation of stack frames
      this.updatePC();
      this.updateSP();
      this.refreshMemory();
    },

    updatePC() {
      if (PC_REG_INDEX) {
        try {
          this.pc = Number(getPC());
        } catch (e) {
          this.pc = -1;
        }
      } else {
        this.pc = -1;
      }
    },

    updateSP() {
      if (SP_REG_INDEX) {
        try {
          const spValue = getSP();
          this.sp = spValue !== null ? Number(spValue) : -1;
        } catch (e) {
          this.sp = -1;
        }
      } else {
        this.sp = -1;
      }
    },

    refreshMemory() {
      const dump = this.generateMemoryDump();
      this.setMemoryDump(dump);
    },

    generateMemoryDump(): MemoryBackup {
      // Get all written memory
      const written = this.main_memory.getWritten();

      // Create a sparse array representation - we store written addresses and values
      // but display from 0 to highest address
      const addresses = written.map(b => b.addr);
      const values = written.map(b => b.value);

      // Get all hints from memory
      const hints = this.main_memory.getAllHints().map(h => ({
        address: h.address.toString(),
        tag: h.tag,
        type: h.type || "",
        sizeInBits: h.sizeInBits,
      }));

      // Add instruction hints from loaded instructions
      if (instructions && instructions.length > 0) {
        const wordSizeBytes =
          architecture.config.word_size / architecture.config.byte_size;

        for (const instruction of instructions) {
          try {
            // Parse instruction address
            const addr = parseInt(instruction.Address, 16);

            // Read the instruction bytes from memory for decoding
            const allBytes = [];
            for (let j = 0; j < MAXNWORDS; j++) {
              const wordAddr = addr + j * wordSizeBytes;
              try {
                const wordBytes = this.main_memory.readWord(BigInt(wordAddr));
                allBytes.push(...new Uint8Array(wordBytes));
              } catch {
                break; // Stop if we can't read more
              }
            }

            // Decode to get instruction metadata including nwords
            if (allBytes.length > 0) {
              const decoded = decode(new Uint8Array(allBytes));

              if (decoded.status === "ok") {
                // Calculate instruction size in bits
                const instructionSizeInBits =
                  decoded.instruction.nwords * architecture.config.word_size;

                // Add hint for this instruction
                hints.push({
                  address: addr.toString(),
                  tag: [instruction.loaded || instruction.user],
                  type: "instruction",
                  sizeInBits: instructionSizeInBits,
                });
              }
            }
          } catch (error) {
            // Skip instructions that can't be decoded
            console.debug(
              "Could not decode instruction at",
              instruction.Address,
              error,
            );
          }
        }
      }

      // Get the highest possible address from memory segments
      const segments = this.main_memory.getMemorySegments();
      let highestAddress = 0;
      for (const segment of segments.values()) {
        highestAddress = Math.max(highestAddress, Number(segment.end));
      }

      return { addresses, values, highestAddress, hints };
    },

    setMemoryDump(dump: MemoryBackup) {
      this.renderState = {};

      // Save current scroll position before updating
      const hexViewerBody = this.$refs.hexViewerBody as HTMLElement;
      const savedScrollTop = hexViewerBody?.scrollTop ?? 0;

      this.memoryDump = dump;
      this.selectedByte = -1;

      // Build hint map with color assignment
      this.hintMap.clear();
      const hintColors = new Map<string, number>();
      let colorIndex = 0;

      for (const hint of dump.hints) {
        const address = parseInt(hint.address, 10);
        // Use only type for instructions to give them all the same color
        const tagTypeKey =
          hint.type === "instruction"
            ? "instruction"
            : `${hint.tag}:${hint.type}`;

        if (!hintColors.has(tagTypeKey)) {
          // Assign blue color (index 1) to instructions
          const assignedColor =
            hint.type === "instruction" ? 1 : colorIndex % 8;
          hintColors.set(tagTypeKey, assignedColor);
          if (hint.type !== "instruction") {
            colorIndex++;
          }
        }

        const hintColorIndex = hintColors.get(tagTypeKey)!;
        const sizeInBytes = hint.sizeInBits
          ? Math.ceil(hint.sizeInBits / 8)
          : 1;

        for (let i = 0; i < sizeInBytes; i++) {
          this.hintMap.set(address + i, {
            tag: hint.tag.join(", "),
            type: hint.type,
            sizeInBits: hint.sizeInBits,
            colorIndex: hintColorIndex,
          });
        }
      }

      this.$nextTick(() => {
        // Restore scroll position after render
        if (hexViewerBody && savedScrollTop > 0) {
          hexViewerBody.scrollTop = savedScrollTop;
        } else {
          this.pageScrollTop = 0;
        }
      });
    },

    getMemoryValue(address: number): number {
      if (!this.memoryDump) return 0;
      const index = this.memoryDump.addresses.indexOf(address);
      return index !== -1 ? (this.memoryDump.values[index] ?? 0) : 0;
    },

    saveScrollPosition() {
      const hexViewerBody = this.$refs.hexViewerBody as HTMLElement;
      if (hexViewerBody) {
        this.pageScrollTop = hexViewerBody.scrollTop;
      }
    },

    restoreScrollPosition() {
      this.$nextTick(() => {
        const hexViewerBody = this.$refs.hexViewerBody as HTMLElement;
        if (hexViewerBody) {
          hexViewerBody.scrollTop = this.pageScrollTop;
        }
      });
    },

    nextPage() {
      if (this.hasNextPage) {
        this.saveScrollPosition();
        this.currentPage++;
        this.restoreScrollPosition();
      }
    },

    previousPage() {
      if (this.hasPreviousPage) {
        this.saveScrollPosition();
        this.currentPage--;
        this.restoreScrollPosition();
      }
    },

    handleScroll() {
      // Save scroll position as user scrolls
      this.saveScrollPosition();
    },

    handleResize() {
      this.windowWidth = window.innerWidth;
      this.updateBytesPerRow();
      this.updateAsciiVisibility();
      this.renderState = {};
    },

    updateBytesPerRow() {
      const newBytesPerRow = this.windowWidth > 900 ? 16 : 8;
      if (newBytesPerRow !== this.bytesPerRow) {
        this.bytesPerRow = newBytesPerRow;
      }
    },

    updateAsciiVisibility() {
      const wasShowingAscii = this.showAscii;
      this.showAscii = this.windowWidth >= 1220;

      // Reset to hex view when ASCII column becomes visible
      if (!wasShowingAscii && this.showAscii && this.viewMode === "ascii") {
        this.viewMode = "hex";
      }
    },

    handleGotoAddress(addrStr: string) {
      if (!addrStr || addrStr.trim() === "" || !this.memoryDump) return;

      let parsedAddress =
        addrStr.startsWith("0x") || addrStr.startsWith("0X")
          ? parseInt(addrStr, 16)
          : parseInt(addrStr, 10);

      if (isNaN(parsedAddress)) return;

      parsedAddress = Math.max(
        0,
        Math.min(parsedAddress, this.memoryDump.highestAddress),
      );

      // Calculate which page contains this address
      const row = Math.floor(parsedAddress / this.bytesPerRow);
      const targetPage = Math.floor(row / this.rowsPerPage);

      // Navigate to the target page
      this.currentPage = targetPage;

      // Scroll to the row within the page
      this.$nextTick(() => {
        const hexViewerBody = this.$refs.hexViewerBody as HTMLElement;
        if (hexViewerBody) {
          const rowInPage = row % this.rowsPerPage;
          const scrollTop = rowInPage * this.rowHeight;
          hexViewerBody.scrollTop = scrollTop;
          this.pageScrollTop = scrollTop;

          // Select the byte after scrolling
          this.$nextTick(() => {
            this.selectByte(parsedAddress);
          });
        }
      });
    },

    handleKeyDown(e: KeyboardEvent) {
      if (!this.memoryDump || this.memoryDump.highestAddress === 0) return;

      const maxIndex = this.memoryDump.highestAddress;
      const currentSelection = this.selectedByte;
      let newSelection: number;

      switch (e.key) {
        case "ArrowLeft":
          newSelection = Math.max(0, currentSelection - 1);
          break;
        case "ArrowRight":
          newSelection = Math.min(maxIndex, currentSelection + 1);
          break;
        case "ArrowUp":
          newSelection = Math.max(0, currentSelection - this.bytesPerRow);
          break;
        case "ArrowDown":
          newSelection = Math.min(
            maxIndex,
            currentSelection + this.bytesPerRow,
          );
          break;
        case "Home":
          newSelection =
            Math.floor(currentSelection / this.bytesPerRow) * this.bytesPerRow;
          break;
        case "End":
          newSelection = Math.min(
            maxIndex,
            Math.floor(currentSelection / this.bytesPerRow) * this.bytesPerRow +
              this.bytesPerRow -
              1,
          );
          break;
        case "PageUp":
          newSelection = Math.max(0, currentSelection - this.bytesPerRow * 10);
          break;
        case "PageDown":
          newSelection = Math.min(
            maxIndex,
            currentSelection + this.bytesPerRow * 10,
          );
          break;
        default:
          return;
      }

      e.preventDefault();
      this.selectByte(newSelection);
    },

    handleByteClick(index: number, event: MouseEvent) {
      this.selectByte(index);
      this.handleByteMouseOver(index, event);
    },

    handleByteDoubleClick(index: number) {
      // Start editing the byte
      this.editingByte = index;
      const currentValue = this.getMemoryValue(index);
      this.editingValue =
        this.viewMode === "hex"
          ? this.toHex(currentValue, 1)
          : String.fromCharCode(
              currentValue >= 32 && currentValue <= 126 ? currentValue : 46,
            ); // 46 is '.'

      // Focus the input after it's rendered
      this.$nextTick(() => {
        const input = this.$el.querySelector(
          `input.byte-editor[data-index="${index}"]`,
        ) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      });
    },

    handleEditInput(index: number) {
      // In hex mode, if user types 2 characters, save and move to next byte
      if (this.viewMode === "hex" && this.editingValue.length >= 2) {
        // Validate it's a valid hex value
        if (/^[0-9a-fA-F]{2}$/.test(this.editingValue)) {
          const success = this.saveByteEditAndContinue(index);
          if (
            success &&
            this.memoryDump &&
            index < this.memoryDump.highestAddress
          ) {
            // Move to next byte
            this.handleByteDoubleClick(index + 1);
          }
        }
      }
    },

    handleEditKeyDown(event: KeyboardEvent, index: number) {
      if (event.key === "Enter") {
        event.preventDefault();
        this.saveByteEdit(index);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.cancelByteEdit();
      }
    },

    saveByteEdit(index: number) {
      if (this.editingByte !== index) return;

      let newValue: number;

      if (this.viewMode === "hex") {
        // Parse hex value
        const hexValue = this.editingValue.trim();
        if (!/^[0-9a-fA-F]{1,2}$/.test(hexValue)) {
          // Invalid hex value, cancel edit
          this.cancelByteEdit();
          return;
        }
        newValue = parseInt(hexValue, 16);
      } else {
        // Parse ASCII value
        if (this.editingValue.length === 0) {
          this.cancelByteEdit();
          return;
        }
        newValue = this.editingValue.charCodeAt(0);
      }

      // Validate the value is within byte range
      if (newValue < 0 || newValue > 255) {
        this.cancelByteEdit();
        return;
      }

      // Write to memory
      try {
        this.main_memory.write(BigInt(index), newValue);
        this.editingByte = -1;
        this.editingValue = "";

        // Refresh the memory view
        this.refreshMemory();
      } catch (error) {
        console.error("Error writing to memory:", error);
        this.cancelByteEdit();
      }
    },

    saveByteEditAndContinue(index: number): boolean {
      if (this.editingByte !== index) return false;

      let newValue: number;

      if (this.viewMode === "hex") {
        // Parse hex value
        const hexValue = this.editingValue.trim();
        if (!/^[0-9a-fA-F]{1,2}$/.test(hexValue)) {
          return false;
        }
        newValue = parseInt(hexValue, 16);
      } else {
        // Parse ASCII value
        if (this.editingValue.length === 0) {
          return false;
        }
        newValue = this.editingValue.charCodeAt(0);
      }

      // Validate the value is within byte range
      if (newValue < 0 || newValue > 255) {
        return false;
      }

      // Write to memory
      try {
        this.main_memory.write(BigInt(index), newValue);
        this.editingByte = -1;
        this.editingValue = "";

        // Refresh the memory view
        this.refreshMemory();
        return true;
      } catch (error) {
        console.error("Error writing to memory:", error);
        return false;
      }
    },

    cancelByteEdit() {
      this.editingByte = -1;
      this.editingValue = "";
    },

    handleByteMouseOver(index: number, event: MouseEvent) {
      const hintInfo = this.hintMap.get(index);
      if (index === this.pc) {
        this.showHintTooltip(event.target as HTMLElement, {
          tag: "Program Counter",
          type: "Register",
        });
      } else if (index === this.sp) {
        this.showHintTooltip(event.target as HTMLElement, {
          tag: "Stack Pointer",
          type: "Register",
        });
      } else if (hintInfo) {
        this.showHintTooltip(event.target as HTMLElement, hintInfo);
      }
    },

    handleByteMouseOut() {
      this.hideHintTooltip();
    },

    showHintTooltip(element: HTMLElement, hintInfo: any) {
      this.hideHintTooltip();

      const tooltip = document.createElement("div");
      tooltip.className = "hint-tooltip";

      const header = document.createElement("div");
      header.className = "hint-header";
      header.textContent =
        hintInfo.tag + (hintInfo.type ? ` (${hintInfo.type})` : "");
      tooltip.appendChild(header);

      if (hintInfo.sizeInBits) {
        const details = document.createElement("div");
        details.className = "hint-details";
        details.textContent = `Size: ${hintInfo.sizeInBits} bits (${Math.ceil(hintInfo.sizeInBits / 8)} bytes)`;
        tooltip.appendChild(details);
      }

      document.body.appendChild(tooltip);
      this.hintTooltip = tooltip;

      const rect = element.getBoundingClientRect();
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.bottom + 5}px`;

      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
      }
      if (tooltipRect.bottom > window.innerHeight) {
        tooltip.style.top = `${rect.top - tooltipRect.height - 5}px`;
      }
    },

    hideHintTooltip() {
      if (this.hintTooltip) {
        this.hintTooltip.remove();
        this.hintTooltip = null;
      }
    },

    selectByte(index: number) {
      if (
        !this.memoryDump ||
        index < 0 ||
        index > this.memoryDump.highestAddress
      )
        return;

      this.selectedByte = index;

      // Ensure the byte is on the current page
      const row = Math.floor(index / this.bytesPerRow);
      const targetPage = Math.floor(row / this.rowsPerPage);

      if (this.currentPage !== targetPage) {
        this.saveScrollPosition();
        this.currentPage = targetPage;
        this.restoreScrollPosition();
      }

      this.$nextTick(() => {
        const hexByte = this.$el.querySelector(
          `[data-index="${index}"].hex-byte`,
        ) as HTMLElement;
        if (hexByte) {
          hexByte.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
      });
    },

    getByteClass(byteIndex: number, value: number): string[] {
      const classes = ["hex-byte"];

      if (byteIndex === this.selectedByte) {
        classes.push("selected");
      }

      if (byteIndex === this.pc) {
        classes.push("pc-indicator");
      }

      if (byteIndex === this.sp) {
        classes.push("sp-indicator");
      }

      if (value === 0 && byteIndex !== this.pc && byteIndex !== this.sp) {
        classes.push("zero");
      }

      const hintInfo = this.hintMap.get(byteIndex);
      if (hintInfo) {
        classes.push(`hint-${hintInfo.colorIndex}`);
      }

      return classes;
    },

    getAsciiCharClass(byteIndex: number): string[] {
      const classes = ["ascii-char"];

      if (byteIndex === this.selectedByte) {
        classes.push("selected");
      }

      if (byteIndex === this.pc) {
        classes.push("pc-indicator");
      }

      if (byteIndex === this.sp) {
        classes.push("sp-indicator");
      }

      const hintInfo = this.hintMap.get(byteIndex);
      if (hintInfo) {
        classes.push(`hint-${hintInfo.colorIndex}`);
      }

      return classes;
    },

    toHex(value: number, bytes: number): string {
      return value
        .toString(16)
        .toUpperCase()
        .padStart(bytes * 2, "0");
    },

    range(start: number, end: number): number[] {
      return Array.from({ length: end - start }, (_, i) => start + i);
    },

    getSegmentVariant(address: number): string {
      const segmentName = this.main_memory.getSegmentForAddress(
        BigInt(address),
      );
      if (!segmentName) return "secondary";

      switch (segmentName.replace(/^\.+/, "")) {
        case "ktext":
        case "text":
          return "info";
        case "kdata":
        case "data":
          return "warning";
        case "stack":
          return "success";
        default:
          return "secondary";
      }
    },

    refresh() {
      this.refreshMemory();
    },

    jumpToSegment(segmentName: string) {
      const segment = this.memorySegments.get(segmentName);
      if (segment) {
        const startAddress = Number(segment.start);
        this.handleGotoAddress(`0x${startAddress.toString(16)}`);
      }
    },

    jumpToMemoryLayoutSegment(segmentName: string) {
      // Close the modal
      this.showMemoryLayoutModal = false;

      // Jump to the segment
      const segment = (architecture.memory_layout as any)[segmentName];
      if (segment) {
        const startAddress = Number(segment.start);
        this.handleGotoAddress(`0x${startAddress.toString(16)}`);
      }
    },
  },
});
</script>

<template>
  <div class="hex-viewer" :class="{ 'modal-open': showMemoryLayoutModal }">
    <div class="hex-viewer-toolbar">
      <div class="toolbar-group">
        <label for="goto-address">Go to:</label>
        <input
          id="goto-address"
          ref="gotoInput"
          class="address-input"
          type="text"
          placeholder="e.g. 0x200000"
          @keydown.enter="
            handleGotoAddress(($refs.gotoInput as HTMLInputElement).value)
          "
        />
        <button
          class="toolbar-button"
          @click="
            handleGotoAddress(($refs.gotoInput as HTMLInputElement).value)
          "
          title="Go to address"
        >
          <font-awesome-icon :icon="['fas', 'arrow-right']" />
          <span class="button-text">Go</span>
        </button>
      </div>

      <div class="toolbar-group segment-group" v-if="segmentList.length > 0">
        <label>Jump to:</label>
        <div class="segment-buttons">
          <button
            v-for="segment in segmentList"
            :key="segment.name"
            class="toolbar-button segment-button"
            @click="jumpToSegment(segment.name)"
            :title="`Jump to ${segment.name} segment (0x${Number(segment.start).toString(16)})`"
          >
            {{ segment.name }}
          </button>
        </div>
      </div>

      <div class="toolbar-group">
        <button
          v-if="!showAscii"
          class="toolbar-button"
          @click="viewMode = viewMode === 'hex' ? 'ascii' : 'hex'"
          :class="{ active: viewMode === 'ascii' }"
          :title="
            viewMode === 'hex' ? 'Switch to ASCII view' : 'Switch to Hex view'
          "
        >
          <font-awesome-icon :icon="['fas', 'exchange-alt']" />
          <span class="button-text">
            {{ viewMode === "hex" ? "Hex" : "ASCII" }}
          </span>
        </button>
        <button
          class="toolbar-button"
          @click="showAllTags = !showAllTags"
          :class="{ active: showAllTags }"
          title="Show all memory tags"
        >
          <font-awesome-icon :icon="['fas', 'tags']" />
          <span class="button-text">Tags</span>
        </button>
        <button
          class="toolbar-button"
          @click="showMemoryLayoutModal = true"
          title="Show memory layout diagram"
        >
          <font-awesome-icon :icon="['fas', 'sitemap']" />
          <span class="button-text keep-on-mobile">Layout</span>
        </button>
      </div>
    </div>

    <div class="hex-viewer-content">
      <div class="hex-viewer-header">
        <div class="address-column-header">Address</div>

        <div class="hex-columns-header">
          <span class="hex-column-header">
            {{ viewMode === "hex" ? "Hex" : "ASCII" }}
          </span>
        </div>

        <div v-if="showAscii" class="ascii-column-header">ASCII</div>
      </div>

      <div
        ref="hexViewerBody"
        class="hex-viewer-body"
        tabindex="0"
        @keydown="handleKeyDown"
        @scroll="handleScroll"
      >
        <div
          v-if="!memoryDump || memoryDump.highestAddress === 0"
          class="no-data"
        >
          No data in memory
        </div>

        <div v-else class="hex-rows">
          <!-- Visible rows for current page only -->
          <div v-for="row in visibleRows" :key="row" class="hex-row-container">
            <!-- Tag labels row (shown when showAllTags is true OR there are stack frames) -->

            <div v-if="tagsByRow.has(row)" class="tag-labels-container">
              <div class="address-column-spacer"></div>

              <div class="tag-labels-wrapper">
                <!-- Each level is a separate row of labels -->
                <div
                  v-for="(level, levelIdx) in tagsByRow.get(row)"
                  :key="levelIdx"
                  class="tag-labels-row"
                >
                  <div class="tag-labels">
                    <span
                      v-for="(tagInfo, idx) in level"
                      :key="idx"
                      class="tag-label"
                      :class="
                        tagInfo.isStackFrame
                          ? `stack-frame-${tagInfo.frameIndex}`
                          : `hint-${tagInfo.colorIndex}`
                      "
                      :style="{
                        left: `calc(${tagInfo.startCol} * (var(--byte-width) + var(--byte-gap)))`,
                        width: `calc((${tagInfo.endCol - tagInfo.startCol + 1}) * (var(--byte-width) + var(--byte-gap)) - var(--byte-gap))`,
                      }"
                    >
                      {{ tagInfo.tag }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Data row -->
            <div class="hex-row" :style="{ height: rowHeight + 'px' }">
              <div
                class="address-column"
                :class="`segment-${getSegmentVariant(row * bytesPerRow)}`"
              >
                {{ `0x${toHex(row * bytesPerRow, 4)}` }}
              </div>

              <div class="hex-columns">
                <span
                  v-for="i in bytesPerRow"
                  :key="i"
                  :data-index="row * bytesPerRow + i - 1"
                  :class="
                    getByteClass(
                      row * bytesPerRow + i - 1,
                      getMemoryValue(row * bytesPerRow + i - 1),
                    )
                  "
                  @click="handleByteClick(row * bytesPerRow + i - 1, $event)"
                  @dblclick="handleByteDoubleClick(row * bytesPerRow + i - 1)"
                  @mouseover="
                    handleByteMouseOver(row * bytesPerRow + i - 1, $event)
                  "
                  @mouseout="handleByteMouseOut"
                >
                  <div
                    v-if="row * bytesPerRow + i - 1 === pc"
                    class="pc-badge-inline"
                  >
                    PC
                  </div>
                  <div
                    v-if="row * bytesPerRow + i - 1 === sp"
                    class="sp-badge-inline"
                  >
                    SP
                  </div>
                  <input
                    v-if="editingByte === row * bytesPerRow + i - 1"
                    type="text"
                    class="byte-editor"
                    :data-index="row * bytesPerRow + i - 1"
                    v-model="editingValue"
                    @input="handleEditInput(row * bytesPerRow + i - 1)"
                    @keydown="
                      handleEditKeyDown($event, row * bytesPerRow + i - 1)
                    "
                    @blur="saveByteEdit(row * bytesPerRow + i - 1)"
                    :maxlength="viewMode === 'hex' ? 2 : 1"
                  />
                  <template v-else>
                    {{
                      (() => {
                        const value = getMemoryValue(row * bytesPerRow + i - 1);
                        return viewMode === "hex"
                          ? toHex(value, 1)
                          : value >= 32 && value <= 126
                            ? String.fromCharCode(value)
                            : ".";
                      })()
                    }}
                  </template>
                </span>
              </div>

              <div v-if="showAscii" class="ascii-column">
                <span
                  v-for="i in bytesPerRow"
                  :key="i"
                  :data-index="row * bytesPerRow + i - 1"
                  :class="getAsciiCharClass(row * bytesPerRow + i - 1)"
                >
                  {{
                    (() => {
                      const value = getMemoryValue(row * bytesPerRow + i - 1);
                      return value >= 32 && value <= 126
                        ? String.fromCharCode(value)
                        : ".";
                    })()
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hex-viewer-footer">
      <div class="pagination-controls">
        <button
          class="pagination-button"
          :disabled="!hasPreviousPage"
          @click="previousPage"
        >
          <font-awesome-icon :icon="['fas', 'chevron-left']" /> Previous
        </button>
        <span class="page-info">
          Page {{ currentPage + 1 }} of {{ totalPages || 1 }}
        </span>
        <button
          class="pagination-button"
          :disabled="!hasNextPage"
          @click="nextPage"
        >
          Next <font-awesome-icon :icon="['fas', 'chevron-right']" />
        </button>
      </div>
    </div>

    <div class="hex-viewer-status">
      <span class="selection-info">{{ selectionInfo }}</span>
    </div>

    <!-- Memory Layout Modal -->
    <transition name="modal-fade">
      <div
        v-if="showMemoryLayoutModal"
        class="memory-layout-modal-overlay"
        @click="showMemoryLayoutModal = false"
      >
        <div class="memory-layout-modal" @click.stop>
          <div class="memory-layout-modal-header">
            <h5>Memory Layout</h5>

            <div class="header-controls">
              <button
                class="invert-button"
                @click="invertMemoryLayout = !invertMemoryLayout"
                :title="
                  invertMemoryLayout
                    ? 'Show high to low addresses'
                    : 'Show low to high addresses'
                "
              >
                <font-awesome-icon :icon="['fas', 'arrows-alt-v']" />
              </button>
              <button
                class="close-button"
                @click="showMemoryLayoutModal = false"
              >
                <font-awesome-icon :icon="['fas', 'times']" />
              </button>
            </div>
          </div>

          <div class="memory-layout-modal-body">
            <MemoryLayoutDiagram
              :memory_layout="architecture.memory_layout"
              :inverted="invertMemoryLayout"
              :show-gaps="true"
              :clickable="true"
              @segment-click="jumpToMemoryLayoutSegment"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.hex-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 0;
  margin: 0;
  font-size: 14px;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  position: relative;
  overflow: hidden;

  /* CSS custom properties for byte sizing */
  --byte-width: 18px;
  --byte-gap: 6px;
  --byte-font-size: 13px;
}

/* Media queries for responsive byte sizing */
@media (min-width: 1000px) {
  .hex-viewer {
    --byte-width: 20px;
    --byte-gap: 7px;
    --byte-font-size: 13px;
  }
}

@media (min-width: 1440px) {
  .hex-viewer {
    --byte-width: 24px;
    --byte-gap: 8px;
    --byte-font-size: 14px;
  }
}

/* Mobile byte sizing */
@media (max-width: 767px) {
  .hex-viewer {
    --byte-width: 24px;
    --byte-gap: 8px;
    --byte-font-size: 14px;
  }
}

.hex-viewer-toolbar {
  display: flex;
  gap: 1rem;
  padding: 6px;
  background: transparent;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-group label {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: bold;
  color: rgba(0, 0, 0, 0.7);
}

/* Mobile toolbar optimization */
@media (max-width: 767px) {
  .hex-viewer-toolbar {
    gap: 0.5rem;
    padding: 4px;
  }
}

.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 16px;
  height: 28px;
  padding: 5px 10px;
  cursor: pointer;
  position: relative;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: bold;

  /* Light theme colors */
  color: rgba(0, 0, 0, 0.8);
  background-color: color-mix(in srgb, currentColor 10%, transparent);
  box-shadow: none;

  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.toolbar-button:hover {
  background-color: color-mix(in srgb, currentColor 15%, transparent);
}

.toolbar-button:active {
  background-color: color-mix(in srgb, currentColor 30%, transparent);
}

.toolbar-button.active {
  background-color: color-mix(in srgb, currentColor 30%, transparent);
  color: rgba(0, 0, 0, 0.9);
}

.toolbar-button.active:hover {
  background-color: color-mix(in srgb, currentColor 35%, transparent);
}

.toolbar-button.active:active {
  background-color: color-mix(in srgb, currentColor 40%, transparent);
}

.toolbar-button:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 50%, transparent);
  outline-offset: 2px;
  transition: outline 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.toolbar-button svg,
.toolbar-button i {
  font-size: 14px;
  opacity: 0.9;
}

.toolbar-button.active svg,
.toolbar-button.active i {
  opacity: 1;
}

/* Mobile toolbar button optimization */
@media (max-width: 767px) {
  /* Hide button text on mobile, show only icons (except Layout) */
  .toolbar-button .button-text:not(.keep-on-mobile) {
    display: none;
  }
}

.segment-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* Hide segment buttons on mobile */
@media (max-width: 999px) {
  .toolbar-group.segment-group {
    display: none;
  }
}

.segment-button {
  padding: 2px 6px;
  font-size: 11px;
  min-width: auto;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.8);
  background-color: color-mix(in srgb, currentColor 10%, transparent);
  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.segment-button:hover {
  background-color: color-mix(in srgb, currentColor 15%, transparent);
}

.segment-button:active {
  background-color: color-mix(in srgb, currentColor 30%, transparent);
}

/* Mobile segment button optimization */
@media (max-width: 767px) {
  .segment-button {
    padding: 2px 4px;
    font-size: 9px;
    letter-spacing: 0.3px;
  }
}

.address-input {
  padding: 4px 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  background-color: color-mix(in srgb, currentColor 5%, transparent);
  color: rgba(0, 0, 0, 0.8);
  font-family: inherit;
  font-size: 12px;
  width: 120px;
  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Mobile address input optimization */
@media (max-width: 767px) {
  .address-input {
    padding: 3px 6px;
    font-size: 11px;
    width: 90px;
  }
}

.address-input:focus {
  outline: none;
  border-color: color-mix(in srgb, currentColor 30%, transparent);
  background-color: color-mix(in srgb, currentColor 8%, transparent);
}

.bytes-info {
  font-size: 12px;
  color: var(--bs-secondary-color);
  font-weight: 500;
}

.hex-viewer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.hex-viewer-header {
  display: flex;
  padding: 8px 6px;
  background: transparent;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
}

.address-column-header {
  width: 100px;
  flex-shrink: 0;
}

.hex-columns-header {
  flex: 1;
  display: flex;
  gap: 8px;
}

.hex-column-header {
  width: var(--byte-width);
  text-align: center;
  font-size: var(--byte-font-size);
}

.ascii-column-header {
  width: auto;
  margin-left: 16px;
  flex-shrink: 0;
}

.hex-viewer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  outline: none;
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--bs-secondary-color);
  font-style: italic;
}

.hex-rows {
  padding: 6px 0;
}

.hex-row-container {
  position: relative;
}

.tag-labels-container {
  display: flex;
  margin-bottom: 2px;
}

.tag-labels-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tag-labels-row {
  display: flex;
  height: 18px;
  position: relative;
}

.address-column-spacer {
  width: 100px;
  flex-shrink: 0;
  padding-right: 12px;
}

.tag-labels {
  flex: 1;
  position: relative;
  height: 18px;
}

.tag-label {
  position: absolute;
  top: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.2);
  line-height: 16px;
  height: 18px;
  box-sizing: border-box;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
}

/* Stack frame colors - matching MemoryTable.vue */
.stack-frame-0 {
  background-color: rgba(40, 167, 69, 0.3) !important;
  /* success - callee */
  border-color: rgba(40, 167, 69, 0.5) !important;
}

.stack-frame-1 {
  background-color: rgba(23, 162, 184, 0.3) !important;
  /* info - caller */
  border-color: rgba(23, 162, 184, 0.5) !important;
}

.stack-frame-2,
.stack-frame-3,
.stack-frame-4,
.stack-frame-5,
.stack-frame-6,
.stack-frame-7,
.stack-frame-8,
.stack-frame-9 {
  background-color: rgba(108, 117, 125, 0.3) !important;
  /* secondary - rest */
  border-color: rgba(108, 117, 125, 0.5) !important;
}

/* Stack hint colors - for register hints */
.hint--2 {
  background-color: rgba(255, 193, 7, 0.3) !important;
  /* warning - stack hints */
  border-color: rgba(255, 193, 7, 0.5) !important;
}

.pc-badge-inline {
  position: absolute;
  top: -3px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--bs-success); /* Green for consistency */
  color: white;
  font-size: 8px;
  line-height: 1;
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: bold;
  z-index: 2;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.sp-badge-inline {
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--bs-info); /* Blue for stack pointer */
  color: white;
  font-size: 8px;
  line-height: 1;
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: bold;
  z-index: 2;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.hex-row {
  display: flex;
  line-height: 24px;
}

.address-column {
  width: 100px;
  flex-shrink: 0;
  color: var(--bs-secondary-color);
  padding-right: 12px;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  padding-left: 6px;
  border-left: 4px solid transparent;
  transition: border-color 0.2s ease;
}

.address-column.segment-info {
  border-left-color: #17a2b8;
  /* Bootstrap info color - text segment */
}

.address-column.segment-warning {
  border-left-color: #ffc107;
  /* Bootstrap warning color - data segment */
}

.address-column.segment-success {
  border-left-color: #28a745;
  /* Bootstrap success color - stack segment */
}

.address-column.segment-secondary {
  border-left-color: #6c757d;
  /* Bootstrap secondary color - other segments */
}

.hex-columns {
  flex: 1;
  display: flex;
  gap: var(--byte-gap);
}

.hex-byte {
  width: var(--byte-width);
  text-align: center;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.1s ease;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  position: relative;
  font-size: var(--byte-font-size);
}

.hex-byte .byte-editor {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  border: 2px solid rgba(0, 123, 255, 0.8);
  border-radius: 3px;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  font-size: inherit;
  padding: 0;
  margin: 0;
  outline: none;
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
  z-index: 100;
}

.hex-byte .byte-editor:focus {
  border-color: rgba(0, 123, 255, 1);
  box-shadow: 0 0 12px rgba(0, 123, 255, 0.7);
}

.hex-byte.selected {
  font-weight: 800;
  background-color: var(--bs-secondary-bg);
  filter: brightness(0.7);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);
}

.hex-byte.zero {
  color: var(--bs-secondary-color);
  opacity: 0.5;
}

.hex-byte.empty {
  color: transparent;
  cursor: default;
}

.ascii-column {
  margin-left: 0px;
  display: flex;
  gap: 1px;
  letter-spacing: 1px;
}

.ascii-char {
  width: calc(var(--byte-width) * 0.46);
  text-align: center;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.1s ease;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  font-size: var(--byte-font-size);
}

.ascii-char.selected {
  filter: brightness(0.5);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.hex-byte.pc-indicator,
.ascii-char.pc-indicator {
  outline: 2px solid var(--bs-success); /* Green for consistency with instructions table */
  outline-offset: -2px;
  z-index: 1;
  opacity: 1 !important;
}

.hex-byte.sp-indicator,
.ascii-char.sp-indicator {
  outline: 2px solid var(--bs-info); /* Blue for stack pointer */
  outline-offset: -2px;
  z-index: 1;
  opacity: 1 !important;
}

/* Dark theme selected byte visibility improvements */
[data-bs-theme="dark"] {
  .hex-byte.selected {
    filter: brightness(1.5);
    background-color: rgba(255, 255, 255, 0.2);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
  }

  .ascii-char.selected {
    filter: brightness(1.5);
    background-color: rgba(255, 255, 255, 0.15);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  }

  .hex-byte.pc-indicator,
  .ascii-char.pc-indicator {
    outline-color: var(--bs-success); /* Keep green for dark theme */
  }

  .hex-byte.sp-indicator,
  .ascii-char.sp-indicator {
    outline-color: var(--bs-info); /* Keep blue for dark theme */
  }
}

.ascii-char.empty {
  color: transparent;
}

.hex-viewer-footer {
  padding: 6px;
  background: transparent;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.pagination-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 24px;
  min-width: 16px;
  padding: 5px 10px;
  cursor: pointer;
  position: relative;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: bold;

  /* Light theme colors */
  color: rgba(0, 0, 0, 0.8);
  background-color: color-mix(in srgb, currentColor 10%, transparent);
  box-shadow: none;

  transition: all 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.pagination-button:hover:not(:disabled) {
  background-color: color-mix(in srgb, currentColor 15%, transparent);
}

.pagination-button:active:not(:disabled) {
  background-color: color-mix(in srgb, currentColor 30%, transparent);
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-button:focus-visible {
  outline: 2px solid color-mix(in srgb, currentColor 50%, transparent);
  outline-offset: 2px;
  transition: outline 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.pagination-button svg,
.pagination-button i {
  font-size: 14px;
  opacity: 0.9;
}

.page-info {
  font-size: 0.8125rem;
  font-weight: bold;
  color: rgba(0, 0, 0, 0.8);
  min-width: 120px;
  text-align: center;
}

.hex-viewer-status {
  display: flex;
  justify-content: space-between;
  padding: 6px;
  background: transparent;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  font-size: 11px;
  gap: 12px;
  flex-wrap: wrap;
}

.selection-info {
  color: rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

/* Hint colors */
.hint-0 {
  background-color: rgba(255, 99, 71, 0.3) !important;
}

.hint-1 {
  background-color: rgba(54, 162, 235, 0.3) !important;
}

.hint-2 {
  background-color: rgba(75, 192, 192, 0.3) !important;
}

.hint-3 {
  background-color: rgba(255, 206, 86, 0.3) !important;
}

.hint-4 {
  background-color: rgba(153, 102, 255, 0.3) !important;
}

.hint-5 {
  background-color: rgba(255, 159, 64, 0.3) !important;
}

.hint-6 {
  background-color: rgba(199, 199, 199, 0.3) !important;
}

.hint-7 {
  background-color: rgba(83, 102, 255, 0.3) !important;
}

/* Dark theme support */
[data-bs-theme="dark"] {
  .hex-viewer-toolbar {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .hex-viewer-header {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .hex-viewer-footer {
    border-top-color: rgba(255, 255, 255, 0.12);
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }

  .hex-viewer-status {
    border-top-color: rgba(255, 255, 255, 0.12);
  }

  .toolbar-button {
    color: rgba(255, 255, 255, 0.9);
  }

  .toolbar-button.active {
    color: rgba(255, 255, 255, 1);
  }

  .segment-button {
    color: rgba(255, 255, 255, 0.9);
  }

  .pagination-button {
    color: rgba(255, 255, 255, 0.9);
  }

  .page-info {
    color: rgba(255, 255, 255, 0.8);
  }

  .address-input {
    border-color: rgba(255, 255, 255, 0.2);
    background-color: color-mix(in srgb, currentColor 5%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }

  .toolbar-group label {
    color: rgba(255, 255, 255, 0.7);
  }

  .selection-info {
    color: rgba(255, 255, 255, 0.8);
  }

  .status-info {
    color: rgba(255, 255, 255, 0.6);
  }

  .tag-label {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .address-column.segment-info {
    border-left-color: #3dd5f3;
    /* Lighter info color for dark theme */
  }

  .address-column.segment-warning {
    border-left-color: #ffcd39;
    /* Lighter warning color for dark theme */
  }

  .address-column.segment-success {
    border-left-color: #48d35c;
    /* Lighter success color for dark theme */
  }

  .address-column.segment-secondary {
    border-left-color: #868e96;
    /* Lighter secondary color for dark theme */
  }

  .pc-badge-inline {
    background-color: var(--bs-success);
    color: white;
  }

  .sp-badge-inline {
    background-color: var(--bs-info);
    color: white;
  }
}

/* Memory Layout Modal Styles */
.memory-layout-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.memory-layout-modal {
  background-color: var(--bs-body-bg);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  max-width: 500px;
  width: 85%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.memory-layout-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.memory-layout-modal-header h5 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--bs-body-color);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.invert-button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--bs-secondary-color);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.invert-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: var(--bs-body-color);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--bs-secondary-color);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: var(--bs-body-color);
}

.memory-layout-modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

[data-bs-theme="dark"] {
  .memory-layout-modal-header {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .close-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .invert-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .memory-layout-modal {
    border-color: rgba(255, 255, 255, 0.2);
  }
}

/* Modal transition animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .memory-layout-modal,
.modal-fade-leave-active .memory-layout-modal {
  transition: transform 0.2s ease;
}

.modal-fade-enter-from .memory-layout-modal {
  transform: scale(0.95);
}

.modal-fade-leave-to .memory-layout-modal {
  transform: scale(0.95);
}
</style>

<style>
/* Global tooltip styles */
.hint-tooltip {
  position: fixed;
  z-index: 9999;
  background-color: var(--bs-dark);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.hint-header {
  font-weight: 600;
  margin-bottom: 4px;
}

.hint-details {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}
</style>
