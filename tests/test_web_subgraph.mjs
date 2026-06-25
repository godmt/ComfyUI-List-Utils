import fs from "node:fs"
import vm from "node:vm"


let extension
const app = {
    graph: {
        _nodes: [],
        links: {},
        getNodeById() {
            return undefined
        },
    },
    registerExtension(value) {
        extension = value
    },
}
const source = fs.readFileSync(new URL("../js/web.js", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "")
vm.runInNewContext(source, {
    app,
    ComfyWidgets: {},
    console,
    document: {},
}, { filename: "web.js" })

const makeNodeType = (factory) => {
    function NodeType() {
        Object.assign(this, factory())
    }
    NodeType.prototype.addInput = function (name, type) {
        this.inputs ??= []
        this.inputs.push({ name, label: name, type, link: null })
    }
    NodeType.prototype.removeInput = function (index) {
        this.inputs.splice(index, 1)
    }
    NodeType.prototype.addOutput = function (name, type) {
        this.outputs ??= []
        this.outputs.push({ name, label: name, type, links: null })
    }
    NodeType.prototype.removeOutput = function (index) {
        this.outputs.splice(index, 1)
    }
    return NodeType
}

const localGraph = {
    _nodes: [],
    links: {},
    getNodeById(id) {
        return this._nodes.find((node) => node.id == id)
    },
}
const packNode = {
    id: 1,
    type: "GODMT_Pack",
    inputs: [
        { name: "image", type: "IMAGE", link: 11 },
        { name: "seed", type: "INT", link: 12 },
        { name: "value_3", type: "*", link: null },
    ],
    outputs: [{ name: "PACK", type: "PACK" }],
}
localGraph._nodes.push(packNode)

const UnpackType = makeNodeType(() => ({
    graph: localGraph,
    inputs: [{ name: "PACK", type: "PACK", link: 100 }],
    outputs: [{ name: "*", label: "*", type: "*" }],
}))
await extension.beforeRegisterNodeDef(UnpackType, { name: "GODMT_Unpack" }, app)
const directUnpack = new UnpackType()
directUnpack.onNodeCreated()
directUnpack.onConnectionsChange(1, 0, true, {
    origin_id: 1,
    origin_slot: 0,
    type: "PACK",
})
if (directUnpack.outputs.length !== 2) throw new Error("Direct Unpack output count is incorrect")
if (directUnpack.outputs[0].name !== "image" || directUnpack.outputs[0].type !== "IMAGE") {
    throw new Error("Direct Unpack did not copy Pack metadata")
}

const relayNode = {
    id: 2,
    type: "Relay",
    inputs: [{ name: "PACK", type: "PACK", link: 101 }],
    outputs: [{ name: "PACK", type: "PACK" }],
}
localGraph._nodes.push(relayNode)
localGraph.links[101] = { id: 101, origin_id: 1, origin_slot: 0, type: "PACK" }
const relayedUnpack = new UnpackType()
relayedUnpack.onConnectionsChange(1, 0, true, {
    origin_id: 2,
    origin_slot: 0,
    type: "PACK",
})
if (relayedUnpack.outputs.length !== 2 || relayedUnpack.outputs[1].type !== "INT") {
    throw new Error("Relayed Unpack did not find Pack inside the local graph")
}

const PackType = makeNodeType(() => ({
    graph: {
        _nodes: [{ id: 3, outputs: [{ type: "STRING" }] }],
        getNodeById(id) {
            return this._nodes.find((node) => node.id == id)
        },
    },
    inputs: [],
    outputs: [{ name: "PACK", type: "PACK" }],
}))
await extension.beforeRegisterNodeDef(PackType, { name: "GODMT_Pack" }, app)
const dynamicPack = new PackType()
dynamicPack.onNodeCreated()
dynamicPack.inputs[0].link = 200
dynamicPack.onConnectionsChange(1, 0, true, {
    origin_id: 3,
    origin_slot: 0,
    type: "STRING",
})
if (dynamicPack.inputs[0].type !== "STRING" || dynamicPack.inputs.length !== 2) {
    throw new Error("Pack did not resolve a subgraph-local type or add an empty input")
}
dynamicPack.graph._nodes.push({ id: 4, outputs: [{ type: "INT" }] })
dynamicPack.inputs[1].link = 201
dynamicPack.onConnectionsChange(1, 1, true, {
    origin_id: 4,
    origin_slot: 0,
    type: "INT",
})
dynamicPack.onConnectionsChange(1, 0, false)
if (dynamicPack.inputs[0].type !== "INT") {
    throw new Error("Disconnecting a Pack input reset the shifted connected input type")
}

const CreateListType = makeNodeType(() => ({
    graph: localGraph,
    inputs: [],
    outputs: [{ name: "*", type: "*" }],
}))
await extension.beforeRegisterNodeDef(CreateListType, { name: "GODMT_CreateList" }, app)
const createList = new CreateListType()
createList.onNodeCreated()
createList.onConnectionsChange(1, 0, false)
if (createList.inputs.length !== 1) {
    throw new Error("Create List must retain one empty input after disconnect")
}

console.log("web subgraph regression tests passed")
