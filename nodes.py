import itertools


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
    def INPUT_TYPES(s):
        return {
            "required": {
                "STRING": ("STRING", {"multiline": True}),
                "delimiter": ("STRING", {"default": ","}),
                "splitlines": ("BOOLEAN", {"default": False}),
                "strip": ("BOOLEAN", {"default": False})
            }
        }
    
    TITLE = "Split String"
    RETURN_TYPES = ("STRING", "LIST", "INT")
    RETURN_NAMES = ("STRING", "LIST", "length")
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


class StringListSelectByIndex:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "STRING": ("STRING", {"forceInput": True}),
                "index": ("INT", {"forceInput": False, "default": 0}),
            }
        }
    
    TITLE = "String List: Select By Index"
    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("STRING", )
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, STRING: list[str], index: list[int]):
        index = index[0]
        if index >= len(STRING):
            print("Error: index out of range")
            return ("", )
        return (STRING[index], )


class ListSelectByIndex:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True}),
                "index": ("INT", {"forceInput": False, "default": 0}),
            }
        }
    
    TITLE = "List: Select By Index"
    RETURN_TYPES = (ANY_TYPE, )
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list, index: list[int]):
        index = index[0]
        if index >= len(ANY):
            print("Error: index out of range")
            return (None, )
        return (ANY[index], )


class BatchSelectByIndex:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "LIST": ("LIST", {"forceInput": True}),
                "index": ("INT", {"default": 0}),
            }
        }
    
    TITLE = "Batch: Select By Index"
    RETURN_TYPES = (ANY_TYPE, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, LIST: list, index: int):
        if index >= len(LIST):
            print("Error: index out of range")
            return (None, )
        return (LIST[index], )


class StringListSlice:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "STRING": ("STRING", {"forceInput": True}),
                "start": ("INT", {"default": 0}),
                "end": ("INT", {"default": 0, "min": -9007199254740991}),
            }
        }
    
    TITLE = "String List: Slice"
    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("STRING", )
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, STRING: list[str], start: list[int], end: list[int]):
        start = start[0]
        end = end[0]
        if end == 0:
            return (STRING[start:], )
        return (STRING[start:end], )


class ListSlice:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY": ("ANY_TYPE", {"forceInput": True}),
                "start": ("INT", {"default": 0}),
                "end": ("INT", {"default": 0, "min": -9007199254740991}),
            }
        }
    
    TITLE = "List: Slice"
    RETURN_TYPES = (ANY_TYPE, )
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list, start: list[int], end: list[int]):
        start = start[0]
        end = end[0]
        if end == 0:
            return (ANY[start:], )
        return (ANY[start:end], )


class BatchSlice:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "LIST": ("LIST", {"forceInput": True}),
                "start": ("INT", {"default": 0}),
                "end": ("INT", {"default": 0, "min": -9007199254740991}),
            }
        }
    
    TITLE = "Batch: Slice"
    RETURN_TYPES = ("LIST", )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, LIST: list, start: int, end: int):
        if end == 0:
            return (LIST[start:], )
        return (LIST[start:end], )


class BatchToStringList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "LIST": ("LIST", ),
            }
        }
    
    TITLE = "Batch To String List"
    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("STRING", )
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, LIST: list):
        str_list = [str(i) for i in LIST]
        return (str_list, )


class StringListToBatch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "STRING": ("STRING", {"forceInput": True}),
            }
        }
    
    TITLE = "String List To Batch"
    RETURN_TYPES = ("LIST", )
    RETURN_NAMES = ("LIST", )
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, STRING: list[str]):
        return (STRING, )


class BatchToList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "LIST": ("LIST", {"forceInput": True}),
            }
        }
    
    TITLE = "Batch To List"
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, LIST: list):
        any_list = [i for i in LIST]
        return (any_list, )


class ListToBatch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY": (ANY_TYPE, {"forceInput": True}),
            }
        }
    
    TITLE = "List To Batch"
    RETURN_TYPES = ("LIST", )
    RETURN_NAMES = ("LIST", )
    INPUT_IS_LIST = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY: list):
        return (ANY, )


class CreateStringList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Create String List"
    RETURN_TYPES = ("STRING", )
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(PACK_PREFIX):
                output_list.append(v)
        return (output_list, )
    

class CreateList:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
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
    RETURN_TYPES = (ANY_TYPE, )
    OUTPUT_IS_LIST = (True, )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(PACK_PREFIX):
                output_list.append(v)
        return (output_list, )


class CreateBatch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {},
            "optional": {},
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Create Batch"
    RETURN_TYPES = ("LIST", )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, unique_id, prompt, extra_pnginfo, **kwargs):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        output_list = []
        for k, v in kwargs.items():
            if k.startswith(PACK_PREFIX):
                output_list.append(v)
        return (output_list, )


PACK_PREFIX = 'value'
class Pack:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
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
    RETURN_TYPES = ("DICT", )
    RETURN_NAMES = ("PACK", )
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
            if k.startswith(PACK_PREFIX):
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
    def INPUT_TYPES(s):
        return {
            "required": {
                "PACK": ("DICT", ),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Unpack"
    RETURN_TYPES = ByPassTypeTuple(("*", ))
    RETURN_NAMES = ByPassTypeTuple(("value_1", ))
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


class AnyToDict:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {}), 
            },
        }
    
    TITLE = "Any To Dict"
    RETURN_TYPES = ("DICT", "STRING")
    RETURN_NAMES = ("DICT", "str()")
    OUTPUT_NODE = True
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
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {}), 
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Get Widgets Values"
    RETURN_TYPES = ("LIST", )
    RETURN_NAMES = ("LIST", )
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY, unique_id, prompt, extra_pnginfo):
        node_list = extra_pnginfo["workflow"]["nodes"]  # list of dict including id, type
        cur_node = next(n for n in node_list if str(n["id"]) == unique_id)
        link_id = cur_node["inputs"][0]["link"]
        link = next(l for l in extra_pnginfo["workflow"]["links"] if l[0] == link_id)
        in_node_id, in_socket_id = link[1], link[2]
        in_node = next(n for n in node_list if n["id"] == in_node_id)
        return (in_node["widgets_values"], )


class GetLength:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "ANY" : (ANY_TYPE, {}), 
            },
        }
    
    TITLE = "Get Length"
    RETURN_TYPES = ("INT", )
    RETURN_NAMES = ("length", )
    FUNCTION = "run"
    CATEGORY = "list_utils"

    def run(self, ANY):
        return (len(ANY), )


class GetShape:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "tensor" : ("IMAGE,LATENT,MASK", {}), 
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }
    
    TITLE = "Get Shape"
    RETURN_TYPES = ("INT", "INT", "INT", "INT")
    RETURN_NAMES = ("width", "height", "batch_size", "channels")
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


NODE_CLASS_MAPPINGS = {
    "GODMT_SplitString": SplitString,
    "GODMT_StringListSelectByIndex": StringListSelectByIndex,
    "GODMT_ListSelectByIndex": ListSelectByIndex,
    "GODMT_BatchSelectByIndex": BatchSelectByIndex,
    "GODMT_StringListSlice": StringListSlice,
    "GODMT_ListSlice": ListSlice,
    "GODMT_BatchSlice": BatchSlice,
    "GODMT_BatchToStringList": BatchToStringList,
    "GODMT_StringListToBatch": StringListToBatch,
    "GODMT_BatchToList": BatchToList,
    "GODMT_ListToBatch": ListToBatch,
    "GODMT_CreateStringList": CreateStringList,
    "GODMT_CreateList": CreateList,
    "GODMT_CreateBatch": CreateBatch,
    "GODMT_Pack": Pack,
    "GODMT_Unpack": Unpack,
    "GODMT_AnyToDict": AnyToDict,
    "GODMT_GetLength": GetLength,
    "GODMT_GetShape": GetShape,
    "GODMT_GetWidgetsValues": GetWidgetsValues,
}
