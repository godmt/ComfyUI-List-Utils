import importlib.util
import unittest
from pathlib import Path

import numpy as np


MODULE_PATH = Path(__file__).resolve().parents[1] / "nodes.py"
SPEC = importlib.util.spec_from_file_location("list_utils_nodes", MODULE_PATH)
list_utils = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(list_utils)


def make_workflow():
    return {
        "workflow": {
            "nodes": [
                {"id": 10, "type": "subgraph-a", "inputs": [], "outputs": []},
            ],
            "links": [],
            "definitions": {
                "subgraphs": [
                    {
                        "id": "subgraph-a",
                        "nodes": [
                            {
                                "id": 20,
                                "type": "Primitive",
                                "inputs": [],
                                "outputs": [{"type": "IMAGE"}],
                                "widgets_values": ["hello"],
                            },
                            {
                                "id": 30,
                                "type": "GODMT_Pack",
                                "inputs": [
                                    {"name": "image", "type": "IMAGE", "link": 1},
                                    {"name": "seed", "type": "INT", "link": 2},
                                    {"name": "value_3", "type": "*", "link": None},
                                ],
                                "outputs": [{"type": "PACK"}],
                            },
                            {
                                "id": 40,
                                "type": "GODMT_GetShape",
                                "inputs": [{"name": "tensor", "type": "IMAGE", "link": 3}],
                                "outputs": [{"type": "INT"}],
                            },
                            {
                                "id": 50,
                                "type": "GODMT_GetWidgetsValues",
                                "inputs": [{"name": "ANY", "type": "*", "link": 4}],
                                "outputs": [{"type": "PYLIST"}],
                            },
                            {"id": 60, "type": "subgraph-b", "inputs": [], "outputs": []},
                        ],
                        "links": [
                            {"id": 1, "origin_id": 20, "origin_slot": 0, "target_id": 30, "target_slot": 0, "type": "IMAGE"},
                            {"id": 3, "origin_id": 20, "origin_slot": 0, "target_id": 40, "target_slot": 0, "type": "IMAGE"},
                            [4, 20, 0, 50, 0, "IMAGE"],
                        ],
                    },
                    {
                        "id": "subgraph-b",
                        "nodes": [
                            {
                                "id": 70,
                                "type": "GODMT_Pack",
                                "inputs": [
                                    {"name": "text", "type": "STRING", "link": None},
                                    {"name": "value_2", "type": "*", "link": None},
                                ],
                                "outputs": [{"type": "PACK"}],
                            }
                        ],
                        "links": [],
                    },
                ]
            },
        }
    }


class SubgraphSupportTests(unittest.TestCase):
    def test_resolves_nested_execution_ids(self):
        workflow = make_workflow()
        node, graph = list_utils.resolve_workflow_node(workflow, "10:60:70")
        self.assertEqual(node["id"], 70)
        self.assertEqual(graph["id"], "subgraph-b")

    def test_pack_preserves_subgraph_input_metadata(self):
        workflow = make_workflow()
        packed = list_utils.Pack().run(
            "10:30",
            {},
            workflow,
            image="pixels",
            seed=123,
        )[0]
        self.assertEqual(packed["data"][0], {
            "name": "image",
            "type": "IMAGE",
            "value": "pixels",
        })
        self.assertEqual(packed["data"][1], {
            "name": "seed",
            "type": "INT",
            "value": 123,
        })

    def test_pack_falls_back_safely_when_metadata_is_unavailable(self):
        packed = list_utils.Pack().run(
            "missing",
            {},
            {},
            value_1="text",
        )[0]
        self.assertEqual(packed["data"][0]["name"], "value_1")
        self.assertEqual(packed["data"][0]["type"], "*")

    def test_dynamic_input_names_are_not_dropped(self):
        created = list_utils.CreateList().run(
            "10:30",
            {},
            make_workflow(),
            image="pixels",
            seed=123,
        )
        self.assertEqual(created, (["pixels", 123],))

    def test_get_shape_resolves_subgraph_link(self):
        result = list_utils.GetShape().run(
            np.zeros((2, 32, 48, 3)),
            "10:40",
            {},
            make_workflow(),
        )
        self.assertEqual(result["result"], (48, 32, 2, 3))

    def test_get_widgets_values_supports_object_and_legacy_links(self):
        result = list_utils.GetWidgetsValues().run(
            None,
            "10:50",
            {},
            make_workflow(),
        )
        self.assertEqual(result["result"], (["hello"],))


if __name__ == "__main__":
    unittest.main()
