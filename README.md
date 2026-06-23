# ComfyUI-List-Utils

[Japanese](README.ja.md)

Primitive ComfyUI custom nodes for working with ComfyUI List processing, raw Python list values, and typed value bundles.

This extension uses three similar-looking but very different container concepts:

| Name | Meaning | Main Use |
| --- | --- | --- |
| `List` | ComfyUI's official Data list / List processing | Run downstream nodes once per item |
| `PyList` | A raw Python `list` value | Keep an array as one value and manipulate it directly |
| `Pack` | A List-Utils typed container | Bundle values of different ComfyUI types and restore them later |

## Installation

Clone this repository into `ComfyUI/custom_nodes`, then restart ComfyUI.

```bash
git clone https://github.com/godmt/ComfyUI-List-Utils.git
```

Nodes are added under the `list_utils` category.

## GUI Help

The nodes include inline help for the ComfyUI interface:

- Node-level descriptions explain what each node is for.
- Inputs and widgets include tooltips for expected values.
- Outputs include tooltips for what they return.
- Dynamic inputs created by `Create List`, `Create PyList`, `Merge List`, `Merge PyList`, `Pack`, and `Exec` also receive tooltips.

## Choosing List, PyList, Or Pack

### List

`List` means ComfyUI List processing. Use it when you want ComfyUI to process several prompts, seeds, images, paths, or other values one item at a time.

List-Utils `List` nodes use ComfyUI's `OUTPUT_IS_LIST` / `INPUT_IS_LIST` behavior. The output socket type remains the original item type, such as `STRING`, `INT`, or `IMAGE`.

Common uses:

- Send several strings downstream one by one
- Generate sequential seeds with `Create Range`
- Enumerate files with `List Dir`
- Extract or slice a ComfyUI List with `List: Get By Index` / `List: Slice`

### PyList

`PyList` is a raw Python `list` passed as one ComfyUI value. It does not trigger ComfyUI List processing by itself.

Common uses:

- Keep strings, numbers, paths, or other values as one array
- Use Python-style index, slice, merge, or cast operations
- Convert a ComfyUI List into one Python list with `List To PyList`
- Convert a Python list back into ComfyUI List processing with `PyList To List`

### Pack

`Pack` bundles multiple values into one `PACK` socket while preserving each input's name, type, and value.

Use `Pack` / `Unpack` when you need to pass different ComfyUI types together. For example, a single Pack can carry `MODEL`, `CLIP`, `VAE`, `CONDITIONING`, and `IMAGE` values, then restore them as separate typed outputs later.

## Typical Workflows

### Split Text And Process Each Item

1. Put multiline or delimiter-separated text into `Split String`.
2. Use the `STRING` output when you want ComfyUI List processing.
3. Use the `PYLIST` output when you want one raw Python list value.
4. Use `length` when you need the item count.

### Convert PyList To ComfyUI List

1. Create a `PYLIST` with `Create PyList`, `Split String`, `Create Range`, or a similar node.
2. Connect it to `PyList To List`.
3. The output becomes a ComfyUI List-processing output and downstream nodes run once per item.

Use `List To PyList` for the opposite direction, when you want to collect a ComfyUI List into one Python list value.

### Bundle Different Types

1. Connect values to `Pack`.
2. Connecting the last empty socket adds another input automatically.
3. Connect `Pack` to `Unpack`.
4. `Unpack` creates outputs matching the input count and types from `Pack`.

`Unpack` can determine its output types after being connected to `Pack` once. It can also trace through some intermediate nodes such as switch-style nodes or Anything Everywhere-style nodes when the upstream `Pack` is discoverable.

## Nodes

### Create / Generate

| Node | Output | Description |
| --- | --- | --- |
| `Split String` | `STRING` List, `PYLIST`, `length` | Splits text by delimiter and/or lines. Empty items are removed. |
| `Create List` | `List` | Creates a ComfyUI List from multiple dynamic inputs. |
| `Create PyList` | `PYLIST` | Creates a raw Python list value from multiple dynamic inputs. |
| `Create Range` | `INT` List, `PYLIST`, `length` | Creates integer values with Python `range(start, stop, step)`. |
| `Create Arange` | `FLOAT` List, `PYLIST`, `length` | Creates values with `numpy.arange(start, stop, step)`. |
| `Create Linspace` | `FLOAT` List, `PYLIST`, `length` | Creates evenly spaced values with `numpy.linspace(start, stop, num)`. |
| `List Dir` | `STRING` List, `PYLIST`, `length` | Lists path matches from a folder using a `glob` pattern. |

### Merge / Convert

| Node | Output | Description |
| --- | --- | --- |
| `Merge List` | `List` | Concatenates multiple ComfyUI Lists. |
| `Merge PyList` | `PYLIST` | Concatenates multiple PyLists. |
| `List To PyList` | `PYLIST` | Collects a ComfyUI List into one Python list value. |
| `PyList To List` | `List` | Expands a PyList into ComfyUI List processing. |

### Get / Slice

| Node | Output | Description |
| --- | --- | --- |
| `List: Get By Index` | item | Reads one item from a ComfyUI List by index. |
| `PyList: Get By Index` | item | Reads one item from a PyList by index. |
| `List: Slice` | `List` | Slices a ComfyUI List with Python-style `start:end`. |
| `PyList: Slice` | `PYLIST` | Slices a PyList with Python-style `start:end`. |

### Pack / Unpack

| Node | Output | Description |
| --- | --- | --- |
| `Pack` | `PACK` | Bundles multiple inputs with their names, types, and values. |
| `Unpack` | original types | Restores values from a Pack. Output types change dynamically to match the connected Pack. |

### Inspect / Utility

| Node | Output | Description |
| --- | --- | --- |
| `Get Length` | `INT` | Returns `len(value)` and displays it on the node. |
| `Get Shape` | `width`, `height`, `PyList_size`, `channels` | Reads shape information from `IMAGE`, `LATENT`, or `MASK`. |
| `Any To Dict` | `DICT`, `str()` | Converts an object to a dict when possible and also returns `str(value)`. |
| `Get Widgets Values` | `LIST` | Reads and displays widget values from the connected upstream node. |
| `Any Cast` | selected type | Relabels a value as a selected type and converts basic scalar types when possible. |
| `PyList Item Cast` | `PYLIST` | Converts each item inside a PyList to `STRING`, `INT`, `FLOAT`, `BOOLEAN`, and similar types. |
| `Exec` | any | Runs Python code using inputs as `x[0]`, `x[1]`, ... and returns `result`. |

## Dynamic Inputs

These nodes add input sockets dynamically:

- `Create List`
- `Create PyList`
- `Merge List`
- `Merge PyList`
- `Pack`
- `Exec`

Connect the last empty socket to add the next socket. Disconnecting sockets cleans up unused inputs.

`Create List` / `Merge List` adapt their output type from the first connected input. `Pack` preserves the type of each input separately.

## Notes

- `List` and `PyList` are different. If a connection does not work, or execution is not happening in the expected mode, use `List To PyList` or `PyList To List`.
- `List: Get By Index` and `PyList: Get By Index` return `None` when the index is out of range.
- Slices use Python behavior: `start:end` does not include the item at `end`.
- `Exec` runs arbitrary Python code. Use it only in workflows you trust.

## Example

![Example workflow](https://github.com/user-attachments/assets/d1543cf3-84db-4b94-b326-88d48f46bd49)
