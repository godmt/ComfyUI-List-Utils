import numpy as np
import itertools
import json
import numbers
from pathlib import Path


VAR_PREFIX = 'value'

# wildcard trick is taken from pythongossss's
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


ANY_TYPE = AnyType("*")


class ByPassTypeTuple(tuple):
	def __getitem__(self, index):
		if index > 0:
			index = 0
		item = super().__getitem__(index)
		if isinstance(item, str):
			return AnyType(item)
		return item


# TODO with linked sockets
def get_input_nodes(extra_pnginfo, unique_id):
    node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
    node = next(n for n in node_list if n["id"] == unique_id)
    input_nodes = []
    for i, input in enumerate(node["inputs"]):
        link_id = input["link"]
        link = next(l for l in extra_pnginfo["workflow"]["links"] if l[0] == link_id)
        in_node_id, in_socket_id = link[1], link[2]
        in_node = next(n for n in node_list if n["id"] == in_node_id)
        input_nodes.append(in_node)
    return input_nodes


def get_input_types(extra_pnginfo, unique_id):
    node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
    node = next(n for n in node_list if n["id"] == unique_id)
    input_types = []
    for i, input in enumerate(node["inputs"]):
        link_id = input["link"]
        link = next(l for l in extra_pnginfo["workflow"]["links"] if l[0] == link_id)
        in_node_id, in_socket_id = link[1], link[2]
        in_node = next(n for n in node_list if n["id"] == in_node_id)
        input_type = in_node["outputs"][in_socket_id]["type"]
        input_types.append(input_type)
    return input_types


class SplitString:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "STRING": ("STRING", {"multiline": True, "tooltip": "Text to split. Multiline text is supported."}),
                "delimiter": ("STRING", {"default": ",", "tooltip": "Delimiter used inside each line. Leave empty to skip delimiter splitting."}),
                "splitlines": ("BOOLEAN", {"default": False, "tooltip": "Split the input into lines before applying the delimiter."}),
                "strip": ("BOOLEAN", {"default": False, "tooltip": "Trim leading and trailing whitespace from each item."})
            }
        }
    
    TITLE = "Split String"
    DESCRIPTION = "Split text into both a ComfyUI List-processing output and a PyList. Useful for prompt candidates, filenames, seed lists, and other simple batches."
    RETURN_TYPES = ("STRING", "PYLIST", "INT")
    RETURN_NAMES = ("STRING", "PYLIST", "length")
    OUTPUT_TOOLTIPS = (
        "Split items as a ComfyUI List-processing output.",
        "Split items as one raw Python list value.",
        "Number of split items.",
    )
    OUTPUT_IS_LIST = (True, False, False, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, STRING: str, delimiter: str, splitlines: bool, strip: bool):
        if splitlines:
            string_list = STRING.splitlines()
        else:
            string_list = [STRING]
        if delimiter != "":
            result = [s.split(delimiter) for s in string_list]
        else:
            result = string_list
        # flatten
        result = list(itertools.chain.from_iterable(result))
        # strip
        if strip:
            result = [s.strip() for s in result]
        # remove empty
        result = [x for x in result if x]
        
        length = len(result)
        return (result, result, length)


class ListGetByIndex:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True, "tooltip": "Connect a ComfyUI List-processing value."}),
                "index": ("INT", {"forceInput": False, "default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Item index to read. 0 is the first item, -1 is the last item."}),
            }
        }
    
    TITLE = "List: Get By Index"
    DESCRIPTION = "Read one item by index from a ComfyUI List-processing input. Use this for List values, not PyList values."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The item at the selected index. Returns None when the index is out of range.",)
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list, index: list[int]):
        index = index[0]
        if index >= len(ANY):
            print("Error: index out of range")
            return (None, )
        return (ANY[index], )


class PyListGetByIndex:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "PYLIST": ("PYLIST", {"forceInput": True, "tooltip": "Connect a PyList, which is a raw Python list value."}),
                "index": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Item index to read. 0 is the first item, -1 is the last item."}),
            }
        }
    
    TITLE = "PyList: Get By Index"
    DESCRIPTION = "Read one item by index from a PyList. Use this for raw Python list values, not ComfyUI List-processing values."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The item at the selected index. Returns None when the index is out of range.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, PYLIST: list, index: int):
        if index >= len(PYLIST):
            print("Error: index out of range")
            return (None, )
        return (PYLIST[index], )


class ListSlice:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True, "tooltip": "Connect the ComfyUI List-processing value to slice."}),
                "start": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Slice start index, matching Python list[start:end]."}),
                "end": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Slice end index. The item at this index is not included."}),
            }
        }
    
    TITLE = "List: Slice"
    DESCRIPTION = "Slice a ComfyUI List-processing input with Python-style start:end semantics and keep it as a List output."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The sliced ComfyUI List-processing output.",)
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list, start: list[int], end: list[int]):
        start = start[0]
        end = end[0]
        return (ANY[start:end], )


class PyListSlice:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "PYLIST": ("PYLIST", {"forceInput": True, "tooltip": "Connect the PyList to slice."}),
                "start": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Slice start index, matching Python list[start:end]."}),
                "end": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Slice end index. The item at this index is not included."}),
            }
        }
    
    TITLE = "PyList: Slice"
    DESCRIPTION = "Slice a PyList with Python-style start:end semantics and keep it as a PyList output."
    RETURN_TYPES = ("PYLIST", )
    OUTPUT_TOOLTIPS = ("The sliced PyList.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, PYLIST: list, start: int, end: int):
        return (PYLIST[start:end], )


class PyListToList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "PYLIST": ("PYLIST", {"forceInput": True, "tooltip": "Python list value to expand into ComfyUI List processing."}),
            }
        }
    
    TITLE = "PyList To List"
    DESCRIPTION = "Convert a PyList into ComfyUI List processing. Use this when downstream nodes should run once per item."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("Each PyList item emitted as a ComfyUI List-processing item.",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, PYLIST: list):
        return (PYLIST, )


class ListToPyList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True, "tooltip": "ComfyUI List-processing input to collect into one Python list value."}),
            }
        }
    
    TITLE = "List To PyList"
    DESCRIPTION = "Collect a ComfyUI List-processing input into one PyList value. Use this when you want to stop per-item execution and treat the values as an array."
    RETURN_TYPES = ("PYLIST", )
    RETURN_NAMES = ("PYLIST", )
    OUTPUT_TOOLTIPS = ("The whole input List collected as one Python list value.",)
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list):
        return (ANY, )
    

class CreateList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Create List"
    DESCRIPTION = "Create a ComfyUI List-processing output from multiple inputs. Connect the last empty socket to add another input."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("Input values emitted as a ComfyUI List-processing output.",)
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(VAR_PREFIX):
                output_list.append(v)
        return (output_list, )


class CreatePyList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Create PyList"
    DESCRIPTION = "Create a PyList from multiple inputs. Use this when you want to keep an array as one value. Connect the last empty socket to add another input."
    RETURN_TYPES = ("PYLIST", )
    OUTPUT_TOOLTIPS = ("A raw Python list containing the input values.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(VAR_PREFIX):
                output_list.append(v)
        return (output_list, )


class MergeList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Merge List"
    DESCRIPTION = "Concatenate multiple ComfyUI List-processing inputs into one List output."
    INPUT_IS_LIST = True
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The concatenated ComfyUI List-processing output.",)
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        unique_id = unique_id[0]
        prompt = prompt[0]
        extra_pnginfo = extra_pnginfo[0]
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(VAR_PREFIX):
                output_list += v
        return (output_list, )


class MergePyList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Merge PyList"
    DESCRIPTION = "Concatenate multiple PyList inputs as raw Python lists."
    RETURN_TYPES = ("PYLIST", )
    OUTPUT_TOOLTIPS = ("The concatenated PyList.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(VAR_PREFIX):
                output_list += v
        return (output_list, )


class CreateRange:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "start": ("INT", {"default": 0, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "First integer to generate."}),
                "stop": ("INT", {"default": 1, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Stop boundary. This value is not included."}),
                "step": ("INT", {"default": 1, "min": -9007199254740992, "max": 9007199254740992, "tooltip": "Increment between values, matching Python range()."}),
            },
        }
    
    TITLE = "Create Range"
    DESCRIPTION = "Generate integers with Python range(start, stop, step), output as both a ComfyUI List and a PyList. Useful for seeds and indexes."
    RETURN_TYPES = ("INT", "PYLIST", "INT")
    RETURN_NAMES = ("INT", "PYLIST", "length")
    OUTPUT_TOOLTIPS = (
        "Generated integers as a ComfyUI List-processing output.",
        "Generated integers as one Python list value.",
        "Number of generated items.",
    )
    OUTPUT_IS_LIST = (True, False, False)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, start: int, stop: int, step: int):
        range_list = list(range(start, stop, step))
        return (range_list, range_list, len(range_list))


class CreateArange:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "start": ("FLOAT", {"default": 0, "tooltip": "First value to generate."}),
                "stop": ("FLOAT", {"default": 1, "tooltip": "Stop boundary. This value is usually not included."}),
                "step": ("FLOAT", {"default": 1, "tooltip": "Increment between values, matching numpy.arange()."}),
            },
        }
    
    TITLE = "Create Arange"
    DESCRIPTION = "Generate floating-point values with numpy.arange(start, stop, step), output as both a ComfyUI List and a PyList."
    RETURN_TYPES = ("FLOAT", "PYLIST", "INT")
    RETURN_NAMES = ("FLOAT", "PYLIST", "length")
    OUTPUT_TOOLTIPS = (
        "Generated values as a ComfyUI List-processing output.",
        "Generated values as one Python list value.",
        "Number of generated items.",
    )
    OUTPUT_IS_LIST = (True, False, False)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, start: float, stop: float, step: float):
        range_list = list(np.arange(start, stop, step))
        return (range_list, range_list, len(range_list))


class CreateLinspace:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "start": ("FLOAT", {"default": 0, "tooltip": "First value."}),
                "stop": ("FLOAT", {"default": 1, "tooltip": "Last value. numpy.linspace() includes this value."}),
                "num": ("INT", {"default": 10, "min": 2, "tooltip": "Number of values to generate."}),
            },
        }
    
    TITLE = "Create Linspace"
    DESCRIPTION = "Generate evenly spaced values with numpy.linspace(start, stop, num), output as both a ComfyUI List and a PyList."
    RETURN_TYPES = ("FLOAT", "PYLIST", "INT")
    RETURN_NAMES = ("FLOAT", "PYLIST", "length")
    OUTPUT_TOOLTIPS = (
        "Generated values as a ComfyUI List-processing output.",
        "Generated values as one Python list value.",
        "Number of generated items.",
    )
    OUTPUT_IS_LIST = (True, False, False)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, start: float, stop: float, num: int):
        range_list = list(np.linspace(start, stop, num))
        return (range_list, range_list, len(range_list))


class Pack:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Pack"
    DESCRIPTION = "Bundle multiple values, including different ComfyUI types, into one PACK with each input name, type, and value preserved. Use Unpack to restore them."
    RETURN_TYPES = ("PACK", )
    RETURN_NAMES = ("PACK", )
    OUTPUT_TOOLTIPS = ("A List-Utils container that preserves input names, types, and values.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        data = {}
        pack = {
            "id": unique_id,
            "data": data,
        }
        for k, v in kwargs.items():
            if k.startswith(VAR_PREFIX):
                i = int(k.split("_")[1])
                data[i - 1] = {
                    "name": cur_node["inputs"][i - 1]["name"],
                    "type": cur_node["inputs"][i - 1]["type"],
                    "value": v,
                }

        return (pack, )


class Unpack:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "PACK": ("PACK", {"tooltip": "Connect a PACK created by the Pack node. Outputs are rebuilt from its saved names and types."}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Unpack"
    DESCRIPTION = "Extract the original values from a PACK. When connected to Pack, outputs are created from the Pack input names and types."
    RETURN_TYPES = ByPassTypeTuple(("*", ))
    RETURN_NAMES = ByPassTypeTuple(("value_1", ))
    OUTPUT_TOOLTIPS = ByPassTypeTuple(("A value stored in the PACK. Outputs grow dynamically to match the connected Pack.",))
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, PACK: dict, unique_id, prompt, extra_pnginfo):
        length = len(PACK["data"])
        types = []
        names = []
        outputs = []
        for i in range(length):
            d = PACK["data"][i]
            names.append(d["name"])
            types.append(d["type"])
            outputs.append(d["value"])
        return tuple(outputs)


class GetLength:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {"tooltip": "Value to pass to len(). Works with List, PyList, strings, and other values that support len()."}),
            },
        }
    
    TITLE = "Get Length"
    DESCRIPTION = "Apply Python len() to the input and display the result on the node."
    RETURN_TYPES = ("INT", )
    RETURN_NAMES = ("length", )
    OUTPUT_TOOLTIPS = ("The result of len(value).",)
    FUNCTION = "run"
    CATEGORY = "list_utils"
    OUTPUT_NODE = True

    def run(self, ANY):
        length = len(ANY)
        return { "ui": {"text": (f"{length}",)}, "result": (length, ) }


class GetShape:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "tensor" : ("IMAGE,LATENT,MASK", {"tooltip": "IMAGE, LATENT, or MASK whose shape you want to inspect."}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Get Shape"
    DESCRIPTION = "Inspect width, height, batch size, and channels for IMAGE, LATENT, or MASK inputs. LATENT dimensions are converted to image-space size."
    RETURN_TYPES = ("INT", "INT", "INT", "INT")
    RETURN_NAMES = ("width", "height", "PyList_size", "channels")
    OUTPUT_TOOLTIPS = (
        "Width. LATENT inputs are multiplied by 8 to report image-space width.",
        "Height. LATENT inputs are multiplied by 8 to report image-space height.",
        "Batch size. The output name is PyList_size for compatibility with existing workflows.",
        "Channel count. MASK inputs may be reported as 1 channel.",
    )
    FUNCTION = "run"
    CATEGORY = "list_utils"
    OUTPUT_NODE = True

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        # if input_types["tensor"] not in ("IMAGE", "LATENT", "MASK"):
        #     return "Input must be an IMAGE or LATENT or MASK type"
        return True

    def run(self, tensor, unique_id, prompt, extra_pnginfo):  
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        link_id = cur_node["inputs"][0]["link"]
        link = next(l for l in extra_pnginfo["workflow"]["links"] if l[0] == link_id)
        in_node_id, in_socket_id = link[1], link[2]
        in_node = next(n for n in node_list if n["id"] == in_node_id)
        input_type = in_node["outputs"][in_socket_id]["type"]
        
        B, H, W, C = 1, 1, 1, 1
        # IMAGE: [B,H,W,C]
        # LATENT: ["samples"][B,C,H,W]
        # MASK: [H,W] or [B,C,H,W]
        if input_type == "IMAGE":
            B, H, W, C = tensor.shape
        elif input_type == "LATENT" or (type(tensor) is dict and "samples" in tensor):
            B, C, H, W = tensor["samples"].shape
            H *= 8
            W *= 8
        else:  # MASK or type deleted IMAGE
            shape = tensor.shape
            if len(shape) == 2:  # MASK
                H, W = shape
            elif len(shape) == 3:  # MASK
                B, H, W = shape
            elif len(shape) == 4:
                if shape[3] <= 4:  # IMAGE?
                    B, H, W, C = tensor.shape
                else:  # MASK
                    B, C, H, W = shape
        return { "ui": {"text": (f"{W}, {H}, {B}, {C}",)}, "result": (W, H, B, C) }


class AnyToDict:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {"tooltip": "Any value to inspect. dict values pass through; objects with __dict__ are converted with vars()."}),
            },
        }
    
    TITLE = "Any To Dict"
    DESCRIPTION = "Convert any value to a dict when possible and also return its string representation. Intended for debugging."
    RETURN_TYPES = ("DICT", "STRING")
    RETURN_NAMES = ("DICT", "str()")
    OUTPUT_TOOLTIPS = (
        "The value as a dict. Returns an empty dict when conversion is not available.",
        "The str() representation of the input value.",
    )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY):
        if type(ANY) is dict:
            return (ANY, str(ANY))
        elif not hasattr(ANY, '__dict__'):
            print(f"Object of type {type(ANY).__name__} doesn't have a __dict__ attribute")
            return ({}, str(ANY))
        else:
            return (vars(ANY), str(ANY))


class GetWidgetsValues:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {"tooltip": "Connect any output from the node whose widget values you want to inspect. The value is used only to locate the upstream node."}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Get Widgets Values"
    DESCRIPTION = "Read and display the upstream node's widgets_values. Intended for debugging node settings."
    RETURN_TYPES = ("LIST", )
    RETURN_NAMES = ("LIST", )
    OUTPUT_TOOLTIPS = ("The upstream node's widgets_values list.",)
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "list_utils"
    OUTPUT_NODE = True

    def run(self, ANY, unique_id, prompt, extra_pnginfo):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        link_id = cur_node["inputs"][0]["link"]
        link = next(l for l in extra_pnginfo["workflow"]["links"] if l[0] == link_id)
        in_node_id, in_socket_id = link[1], link[2]
        in_node = next(n for n in node_list if n["id"] == in_node_id)
        return { "ui": {"text": (f"{in_node['widgets_values']}",)}, "result": (in_node["widgets_values"], ) }


def try_cast(x, dst_type: str):
    result = x
    if dst_type == "STRING":
        result = str(x)
    elif dst_type == "INT":
        result = int(x)
    elif dst_type == "FLOAT" or dst_type == "NUMBER":
        result = float(x)
    elif dst_type == "BOOLEAN":
        if isinstance(x, numbers.Number):
            if x > 0:
                result = True
            else:
                result = False
        elif isinstance(x, str):
            try:
                x = float(x)
                if x > 0:
                    result = True
                else:
                    result = False
            except:
                result = bool(x)
        else:
            result = bool(x)
    return result


class AnyCast:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {"tooltip": "Value to relabel or convert."}),
                "TYPE": (["*", "STRING", "INT", "FLOAT", "BOOLEAN", "IMAGE", "LATENT", "MASK", "NOISE", "SAMPLER", "SIGMAS", "GUIDER", "MODEL", "CLIP", "VAE", "CONDITIONING", "PYLIST"], {"tooltip": "ComfyUI type shown on the output socket. STRING, INT, FLOAT, and BOOLEAN also attempt Python conversion."}),
            },
        }
    
    TITLE = "Any Cast"
    DESCRIPTION = "Output any value as the selected ComfyUI type. STRING, INT, FLOAT, and BOOLEAN also perform Python conversion."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The value output as the selected TYPE.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY, TYPE):
        result = try_cast(ANY, TYPE)
        return (result, )


class PyListItemCast:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "PYLIST": ("PYLIST", {"forceInput": True, "tooltip": "PyList whose items should be converted."}),
                "TYPE": (["STRING", "INT", "FLOAT", "NUMBER", "BOOLEAN", "PYLIST"], {"tooltip": "Conversion applied to each PyList item. NUMBER is the same as FLOAT."}),
            },
        }
    
    TITLE = "PyList Item Cast"
    DESCRIPTION = "Convert each item inside a PyList to STRING, INT, FLOAT, BOOLEAN, and similar basic types."
    RETURN_TYPES = ("PYLIST", )
    RETURN_NAMES = ("PYLIST", )
    OUTPUT_TOOLTIPS = ("The PyList after converting each item.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, PYLIST: list, TYPE: str):
        converted_list = [try_cast(x, TYPE) for x in PYLIST]
        return (converted_list, )


class ListDir:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "path": ("STRING", {"default": "", "tooltip": "Folder path to list."}),
                "pattern": ("STRING", {"default": "*", "tooltip": "Pattern passed to Path.glob, for example *.png or **/*.json."})
            },
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "List Dir"
    DESCRIPTION = "List files and folders under a path using a glob pattern, output as both a ComfyUI List and a PyList."
    RETURN_TYPES = ("STRING", "PYLIST", "INT")
    RETURN_NAMES = ("STRING", "PYLIST", "length")
    OUTPUT_TOOLTIPS = (
        "Matched items as a ComfyUI List-processing output. Values are Path objects.",
        "Matched items as one Python list value.",
        "Number of matched items.",
    )
    OUTPUT_IS_LIST = (True, False, False, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, path, pattern, unique_id, prompt, extra_pnginfo, **kwargs):
        path = Path(path)
        items = list(path.glob(pattern))
        items.sort()
        return (items, items, len(items))

""" WIP
class DisplayList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "input_list": (ANY_TYPE, {"forceInput": True}),
            },
        }
    
    TITLE = "Display List"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("table_output",)
    FUNCTION = "run"
    CATEGORY = "list_utils"
    OUTPUT_NODE = True

    def run(self, input_list):
        # Convert list to a format for frontend (e.g., JSON)
        if type(input_list) is list:
            pass
        else:
            input_list = [input_list]
        table_data = [{"index": i, "value": item} for i, item in enumerate(input_list)]
        return { "ui": {"text": (json.dumps(table_data) ,)}, "result": (json.dumps(table_data), ) }
"""


class Exec:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "FUNC": ("STRING", {"forceInput": False, "multiline": True, "default": "result = x[0]", "tooltip": "Python code to execute. Input values are x[0], x[1], ... Assign the value to return to result."})
            },
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Exec"
    DESCRIPTION = "Execute Python code with input values available as x[0], x[1], ... and return result. Use only in trusted workflows."
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_TOOLTIPS = ("The value assigned to result inside FUNC.",)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        result_dict = {}
        
        func_str = kwargs["FUNC"]
        
        if "result" not in func_str:
            print("error: no `result` in FUNC")
            return (None, )

        vars_str = "x = []\n"
        for k in kwargs.keys():
            if k.startswith("x["):
                vars_str += f"x.append(kwargs['{k}'])\n"
        foot_str = "\nresult_dict['result'] = result"
        exec_str = vars_str + func_str + foot_str

        exec(exec_str)
        return (result_dict["result"], )


NODE_CLASS_MAPPINGS = {
    "GODMT_SplitString": SplitString,
    "GODMT_ListGetByIndex": ListGetByIndex,
    "GODMT_PyListGetByIndex": PyListGetByIndex,
    "GODMT_ListSlice": ListSlice,
    "GODMT_PyListSlice": PyListSlice,
    "GODMT_ListToPyList": ListToPyList,
    "GODMT_PyListToList": PyListToList,
    "GODMT_CreateList": CreateList,
    "GODMT_CreatePyList": CreatePyList,
    "GODMT_MergeList": MergeList,
    "GODMT_MergePyList": MergePyList,
    "GODMT_CreateRange": CreateRange,
    "GODMT_CreateArange": CreateArange,
    "GODMT_CreateLinspace": CreateLinspace,
    "GODMT_Pack": Pack,
    "GODMT_Unpack": Unpack,
    "GODMT_GetLength": GetLength,
    "GODMT_GetShape": GetShape,
    "GODMT_AnyToDict": AnyToDict,
    "GODMT_GetWidgetsValues": GetWidgetsValues,
    "GODMT_AnyCast": AnyCast,
    "GODMT_PyListItemCast": PyListItemCast,
    "GODMT_ListDir": ListDir,
    "GODMT_Exec": Exec,
}
