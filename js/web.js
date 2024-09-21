// https://gist.github.com/Amorano/9871fb3be1aa75defdfad013e1f95e0e
import { app } from "../../scripts/app.js";
// import { api } from "../../scripts/api.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
// import { addConnectionLayoutSupport } from "./utils.js";

const _prefix = 'value';

const TypeSlot = {
    Input: 1,
    Output: 2,
};

const TypeSlotEvent = {
    Connect: true,
    Disconnect: false,
};

const dynamic_connection = (node, index, event, prefix = 'in_', type = '*', names = []
) => {
    if (!node.inputs[index].name.startsWith(prefix)) {
        return
    }
    // remove all non connected inputs
    if (event == TypeSlotEvent.Disconnect && node.inputs.length > 1) {
        if (node.widgets) {
            const widget = node.widgets.find((w) => w.name === node.inputs[index].name)
            if (widget) {
                widget.onRemoved?.()
                node.widgets.length = node.widgets.length - 1
            }
        }
        node.removeInput(index)

        // TODO type
        // make inputs sequential again
        for (let i = 0; i < node.inputs.length; i++) {
            const name = i < names.length ? names[i] : `${prefix}${i + 1}`
            node.inputs[i].label = name
            node.inputs[i].name = name
        }
    }

    // add an extra input
    if (node.inputs[node.inputs.length - 1].link != undefined) {
        const nextIndex = node.inputs.length
        const name = nextIndex < names.length
            ? names[nextIndex]
            : `${prefix}${nextIndex + 1}`
        node.addInput(name, type)
    }
}


app.registerExtension({
    name: "godmt.ListUtils",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "GODMT_Pack" || nodeData.name === "GODMT_CreateList" || nodeData.name == "GODMT_CreateBatch") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                this.addInput(`${_prefix}_1`, '*')
                return r
            }

            // on copy and paste
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i >= 0; i--) {
                        this.removeInput(i)
                    }
                    this.addInput(`${_prefix}_1`, '*')
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const me = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    dynamic_connection(this, slot, event, `${_prefix}_`, '*')
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const fromNode = this.graph._nodes.find(
                            (otherNode) => otherNode.id == link_info.origin_id
                        )
                        const type = fromNode.outputs[link_info.origin_slot].type
                        this.inputs[slot].type = type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.inputs[slot].type = '*'
                        this.inputs[slot].label = `${_prefix}_${slot + 1}`
                    }
                }
                return me;
            }
        } else if (nodeData.name === "GODMT_CreateStringList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                this.addInput(`${_prefix}_1`, 'STRING')
                return r
            }

            // on copy and paste
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                if (!app.configuringGraph && this.inputs) {
                    const length = this.inputs.length
                    for (let i = length - 1; i >= 0; i--) {
                        this.removeInput(i)
                    }
                    this.addInput(`${_prefix}_1`, 'STRING')
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const me = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    dynamic_connection(this, slot, event, `${_prefix}_`, 'STRING')
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const fromNode = this.graph._nodes.find(
                            (otherNode) => otherNode.id == link_info.origin_id
                        )
                        const type = fromNode.outputs[link_info.origin_slot].type
                        this.inputs[slot].type = type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.inputs[slot].type = 'STRING'
                        this.inputs[slot].label = `${_prefix}_${slot + 1}`
                    }
                }
                return me;
            }
        } else if (nodeData.name === "GODMT_Unpack") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                // shrink outputs to 1
                this.outputs[0].type = "*"
                const output_len = this.outputs.length
                for (let i = output_len - 1; i > 0; i--) {
                    this.removeOutput(i)
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const me = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (this.inputs[slot].type === "DICT") {
                        if (event === TypeSlotEvent.Disconnect) {
                            // shrink outputs to 1
                            if (!this.outputs || this.outputs.length == 0) {
                                this.addOutput(`${_prefix}_1`, "*")
                            }
                            this.outputs[0].type = "*"
                            const output_len = this.outputs.length;
                            for (let i = output_len - 1; i > 0; i--) {
                                this.removeOutput(i)
                            }
                        } else if (event === TypeSlotEvent.Connect && link_info) {
                            // find the origin Pack
                            let link = this.inputs[slot].link  // link ID?
                            let origin_id = app.graph.links[link].origin_id
                            let origin_node = app.graph._nodes.find(n => n.id == origin_id)
                            for (let i = 0; i < 20; i++) {
                                if (origin_node.type === "GODMT_Pack") {
                                    break
                                }
                                if (origin_node.inputs.length == 0) {
                                    break
                                }
                                link = origin_node.inputs[0].link
                                origin_id = app.graph.links[link].origin_id
                                origin_node = app.graph._nodes.find(n => n.id == origin_id)
                            }
                            const origin_inputs = origin_node.inputs
                            const output_len = origin_inputs.length - 1  // end is empty socket
                            const cur_len = this.outputs.length
                            for (let i = cur_len - 1; i >= output_len; i--) {
                                this.removeOutput(i)
                            }
                            for (let i = cur_len; i < output_len; i++) {
                                this.addOutput(`${_prefix}_${i + 1}`, origin_inputs[i].type)
                            }
                            for (let i = 0; i < cur_len; i++) {
                                this.outputs[i].type = origin_inputs[i].type
                            }
                        }
                    }
                } else if (slotType === TypeSlot.Output) {
                    if (event === TypeSlotEvent.Connect && link_info) {

                    }
                }
                return me;
            }
        } else if (nodeData.name === "GODMT_GetShape") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                this.showValueWidget = ComfyWidgets["STRING"](this, "WHBC", ["STRING", { multiline: false }], app).widget;
            };
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message]);
                this.showValueWidget.value = message.text[0];
            };
        }
    }
})
