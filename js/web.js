import { app } from "../../scripts/app.js"
import { ComfyWidgets } from "../../scripts/widgets.js"


// ref: https://gist.github.com/Amorano/9871fb3be1aa75defdfad013e1f95e0e
const _prefix = 'value'

const TypeSlot = {
    Input: 1,
    Output: 2,
}

const TypeSlotEvent = {
    Connect: true,
    Disconnect: false,
}

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

/**
 * Get all unique types in the workflow.
 * @returns {Set} Unique set of all types used in the workflow
 */
function getWorkflowTypes(app) {
    // 実装
    const types = new Set(["*", "STRING", "INT", "FLOAT", "BOOLEAN", "IMAGE", "LATENT", "MASK", "NOISE", "SAMPLER", "SIGMAS", "GUIDER", "MODEL", "CLIP", "VAE", "CONDITIONING"])
    app.graph._nodes.forEach(node => {
        node.inputs.forEach(slot => {
            types.add(slot.type)
        })
        node.outputs.forEach(slot => {
            types.add(slot.type)
        })
    })
    return Array.from(types)
}


app.registerExtension({
    name: "godmt.ListUtils",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "GODMT_Pack" || nodeData.name === "GODMT_CreateBatch") {
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
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
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
                return r
            }
        } else if (nodeData.name === "GODMT_Exec") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                this.addInput(`x[0]`, '*')
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
                    this.addInput(`x[0]`, '*')
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    // remove all non connected inputs
                    if (event == TypeSlotEvent.Disconnect && this.inputs.length > 1) {
                        if (this.widgets) {
                            const widget = this.widgets.find((w) => w.name === this.inputs[slot].name)
                            if (widget) {
                                widget.onRemoved?.()
                                this.widgets.length = this.widgets.length - 1
                            }
                        }
                        this.removeInput(slot)
                        // make inputs sequential again
                        for (let i = 0; i < this.inputs.length; i++) {
                            const name = `x[${i}]`
                            this.inputs[i].label = name
                            this.inputs[i].name = name
                        }
                    }

                    // TODO type
                    const type = "*"
                    // add an extra input
                    if (this.inputs[this.inputs.length - 1].link != undefined) {
                        const nextIndex = this.inputs.length
                        const name = `x[${nextIndex}]`
                        this.addInput(name, type)
                    }

                    if (event === TypeSlotEvent.Connect && link_info) {
                        const fromNode = this.graph._nodes.find(
                            (otherNode) => otherNode.id == link_info.origin_id
                        )
                        const type = fromNode.outputs[link_info.origin_slot].type
                        this.inputs[slot].type = type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.inputs[slot].type = '*'
                        this.inputs[slot].label = `x[${slot}]`
                    }
                    if (this.widgets && this.widgets[0]) {
                        this.widgets[0].y = this.inputs.length * 20
                        // TODO update node height
                    }
                }
                return r
            }
        }
        else if (nodeData.name === "GODMT_CreateList" || nodeData.name === "GODMT_MergeList") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                this.addInput(`${_prefix}_1`, '*')
                return r
            }

            // TODO might be buggy on load
            // on copy, paste, load
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
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (!this.inputs[slot].name.startsWith(_prefix)) {
                        return
                    }

                    if (event == TypeSlotEvent.Connect && link_info) {
                        if (slot == 0) {
                            const node = app.graph.getNodeById(link_info.origin_id)
                            const origin_type = node.outputs[link_info.origin_slot].type
                            this.inputs[0].type = origin_type
                            this.outputs[0].type = origin_type
                            this.outputs[0].label = origin_type
                            this.outputs[0].name = origin_type
                        }
                    }

                    // remove all non connected inputs
                    if (event == TypeSlotEvent.Disconnect && this.inputs.length > 0) {
                        if (this.widgets) {
                            const widget = this.widgets.find((w) => w.name === this.inputs[slot].name)
                            if (widget) {
                                widget.onRemoved?.()
                                this.widgets.length = this.widgets.length - 1
                            }
                        }
                        this.removeInput(slot)
                        // make inputs sequential again
                        for (let i = 0; i < this.inputs.length; i++) {
                            this.inputs[i].label = `${_prefix}_${i + 1}`
                            this.inputs[i].name = `${_prefix}_${i + 1}`
                        }
                    }

                    // add an extra input
                    if (this.inputs[this.inputs.length - 1].link != undefined) {
                        const nextIndex = this.inputs.length
                        this.addInput(`${_prefix}_${nextIndex + 1}`, this.inputs[0].type)
                    }
                }
                return r
            }
        } else if (nodeData.name == "GODMT_MergeBatch") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                this.addInput(`${_prefix}_1`, 'LIST')
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
                    this.addInput(`${_prefix}_1`, 'LIST')
                }
                return r
            }

            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    dynamic_connection(this, slot, event, `${_prefix}_`, 'LIST')
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const fromNode = this.graph._nodes.find(
                            (otherNode) => otherNode.id == link_info.origin_id
                        )
                        const type = fromNode.outputs[link_info.origin_slot].type
                        this.inputs[slot].type = type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.inputs[slot].type = 'LIST'
                        this.inputs[slot].label = `${_prefix}_${slot + 1}`
                    }
                }
                return r
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
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (event === TypeSlotEvent.Connect && link_info) {
                        // find the origin Pack
                        let link_id = this.inputs[slot]?.link
                        let origin_id = app.graph.links[link_id]?.origin_id
                        let origin_node = null
                        for (let i = 0; i < 10; i++) {
                            origin_node = app.graph._nodes.find(n => n.id == origin_id)
                            if (!origin_node) {
                                break
                            }
                            if (origin_node.type === "GODMT_Pack") {
                                break
                            }
                            if (origin_node.inputs.length == 0) {
                                origin_node = null
                                break
                            }
                            let origin_slot = -1
                            for (let i in origin_node.inputs) {
                                if (origin_node.inputs[i].type === "PACK") {
                                    origin_slot = i
                                    break
                                } else if (origin_node.inputs[i].type === "*") {
                                    origin_slot = i
                                }
                            }
                            if (origin_slot == -1) {
                                origin_node = null
                                break
                            }
                            link_id = origin_node.inputs[origin_slot]?.link
                            origin_id = app.graph.links[link_id]?.origin_id
                            if (!origin_id) {
                                break
                            }
                            origin_node = null
                        }
                        // must be GODMT_Pack, but double check
                        if (origin_node && origin_node.type === "GODMT_Pack") {
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
                }
                return r
            }
        } else if (nodeData.name == "GODMT_AnyCast") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
                const onWidgetChanged = this.widgets[0].callback
                const thisNode = this
                this.widgets[0].callback = function () {
                    const me = onWidgetChanged ? onWidgetChanged.apply(this, arguments) : undefined
                    const output_type = thisNode.widgets[0].value
                    thisNode.outputs[0].type = output_type
                    thisNode.outputs[0].label = output_type
                    thisNode.outputs[0].name = output_type
                    return r
                }
                return r
            }
            // on copy, paste, load
            const onConfigure = nodeType.prototype.onConfigure
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined
                const output_type = this.widgets[0].value
                this.outputs[0].type = output_type
                this.outputs[0].label = output_type
                this.outputs[0].name = output_type
                return r
            }
            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const origin_node = app.graph.getNodeById(link_info.origin_id)
                        const origin_slot = origin_node.outputs[link_info.origin_slot]
                        const origin_type = origin_slot.type
                        const types = getWorkflowTypes(app)
                        this.widgets[0].options.values = types
                        const output_type = this.widgets[0].value
                        this.outputs[0].type = output_type
                        this.outputs[0].label = output_type
                        this.outputs[0].name = origin_type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.outputs[0].type = "*"
                        this.outputs[0].label = "*"
                        this.outputs[0].name = "*"
                    }
                }
                return r
            }
        } else if (nodeData.name === "GODMT_GetWidgetsValues") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "values", ["STRING", { multiline: true }], app).widget
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_GetLength") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "length", ["STRING", { multiline: false }], app).widget
                // this.addWidget("STRING", "length", "", () => { }, { multiline: false })
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_GetShape") {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined
                this.showValueWidget = ComfyWidgets["STRING"](this, "WHBC", ["STRING", { multiline: false }], app).widget
            }
            const onExecuted = nodeType.prototype.onExecuted
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message])
                this.showValueWidget.value = message.text[0]
            }
        } else if (nodeData.name === "GODMT_ListGetByIndex" || nodeData.name === "GODMT_ListSlice") {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange
            nodeType.prototype.onConnectionsChange = function (slotType, slot, event, link_info, data) {
                const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined
                if (slotType === TypeSlot.Input) {
                    if (event === TypeSlotEvent.Connect && link_info) {
                        const node = app.graph.getNodeById(link_info.origin_id)
                        let origin_type = node.outputs[link_info.origin_slot].type
                        this.outputs[0].type = origin_type
                        this.outputs[0].label = origin_type
                        this.outputs[0].name = origin_type
                    } else if (event === TypeSlotEvent.Disconnect) {
                        this.outputs[0].type = "*"
                        this.outputs[0].label = "*"
                        this.outputs[0].name = "*"
                    }
                }
                return r
            }
        }
    }
})
