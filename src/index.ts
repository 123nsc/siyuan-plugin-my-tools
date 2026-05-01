import { Plugin, showMessage, getAllEditor, IMenu } from "siyuan";
import * as api from "./api";

export default class PluginSample extends Plugin {
    private my_title_menu_item(blockId?: string) {
        const mt: IMenu = {
            type: "submenu",
            label: "MY-标题操作",
            icon: "iconHeadings",
            submenu: [
                {
                    label: "MY-标题升级",
                    icon: "iconUpload",
                    click: async () => {
                        const docID = (await api.getBlockByID(blockId)).root_id;
                        await changeGrade(docID, 1, true);
                    },
                },
                {
                    label: "MY-标题降级",
                    icon: "iconDownload",
                    click: async () => {
                        const docID = (await api.getBlockByID(blockId)).root_id;
                        await changeGrade(docID, 1, false);
                    },
                },
                {
                    label: "MY-标题添加序号",
                    click: async () => {
                        const docID = (await api.getBlockByID(blockId)).root_id;
                        delete_title_index(docID).then(() => {
                            add_title_index(docID);
                        });
                    },
                },
                {
                    label: "MY-标题去除序号",
                    click: async () => {
                        const docID = (await api.getBlockByID(blockId)).root_id;
                        await delete_title_index(docID);
                    },
                },
            ],
        };
        return mt;
    }
    private my_delete_after_blocks_menu_item(blockId: string) {
        return {
            label: "MY-删除后子块",
            icon: "iconTrashcan",
            click: async () => {
                if (confirm("确定删除？")) {
                    await delete_block_after(blockId);
                    showMessage("✅ 删除成功");
                }
            },
        };
    }
    private my_remove_bold_menu_item(blockIds: string[]) {
        return {
            label: "MY-去除加粗",
            icon: "iconBold",
            click: async () => {
                for (const bid of blockIds) {
                    const txt_md = (await api.getBlockByID(bid)).markdown;
                    let new_md = txt_md.replace(/\*\*/g, "");
                    await api.updateBlock("markdown", new_md, bid);
                    showMessage(bid + " 已去除加粗");
                }
            },
        };
    }
    // 插件开启时执行
    async onload() {
        console.log("✅ 我的插件加载完成1");
    }

    // 思源界面加载完毕后执行
    // 【所有右键菜单、按钮 都写在这里】
    onLayoutReady() {
        // ==========  正文内容 右键菜单 ==========
        this.eventBus.on("open-menu-content", (opts) => {
            const blockElement = opts.detail.element;
            const blockId = blockElement?.dataset.nodeId;
            // opts.detail.menu.addItem(this.my_remove_bold_menu_item([blockId]));
            // opts.detail.menu.addItem(this.my_delete_after_blocks_menu_item(blockId));
            opts.detail.menu.addItem(this.my_title_menu_item(blockId));
        });
        // ==========  块 右键菜单 ==========
        this.eventBus.on("click-blockicon", (opts) => {
            const blockElements = opts.detail.blockElements;
            if (blockElements.length === 1) {
                const blockId = blockElements[0].dataset.nodeId;
                opts.detail.menu.addItem(this.my_remove_bold_menu_item([blockId]));
                opts.detail.menu.addItem(this.my_delete_after_blocks_menu_item(blockId));
                opts.detail.menu.addItem(this.my_title_menu_item(blockId));
            } else {
                const blockIDs = blockElements.map((b) => b.dataset.nodeId);
                opts.detail.menu.addItem(this.my_remove_bold_menu_item(blockIDs));
            }
        });
    }

    // 插件关闭时执行
    async onunload() {
        console.log("❌ 插件已关闭");
    }

    // 插件卸载时执行
    uninstall() {}

    // 工具：获取当前打开的编辑器
    getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("请先打开一篇文档");
            return null;
        }
        return editors[0];
    }
}

// 删除目标块【后面所有块】
async function delete_block_after(block_id: BlockId) {
    // 获取笔记本 ID
    const docID = (await api.getBlockByID(block_id)).root_id;
    if (!docID) return;

    // 获取所有子块
    const children = await api.getChildBlocks(docID);
    const block_ids = children.map((b) => b.id);

    // 删除目标块及后面所有块
    const idx = block_ids.indexOf(block_id);
    if (idx !== -1) {
        const to_del = block_ids.slice(idx);
        for (const bid of to_del) {
            await api.deleteBlock(bid);
        }
    }
}

// 标题升降级（h1 - h2 - h3...）
async function changeGrade(docID: DocumentId, count: number, raise: boolean) {
    while (count > 0) {
        count--;
        if (raise) {
            const h6_blocks = await get_type_blockclass(docID, "h", "h6");
            if (h6_blocks && h6_blocks.length > 0) {
                showMessage(`存在 ${h6_blocks.length} 个 H6 标题，停止降级`);
                return;
            }
        } else {
            const h1_blocks = await get_type_blockclass(docID, "h", "h1");
            if (h1_blocks && h1_blocks.length > 0) {
                showMessage(`存在 ${h1_blocks.length} 个 H1 标题，停止升级`);
                return;
            }
        }
        const blocks = await get_type_blockclass(docID, "h");
        for (const block of blocks) {
            const blockId = block.id ?? "";
            const markdown = block.markdown ?? "";
            let newMarkdown = "";
            if (raise) {
                newMarkdown = markdown.startsWith("#") ? markdown.slice(1) : markdown;
            } else {
                newMarkdown = "#" + markdown;
            }
            await api.updateBlock("markdown", newMarkdown, blockId);
        }
    }
}

let count = {
    h2: 0,
    h3: 0,
    h4: 0,
    h5: 0,
    h6: 0,
};

function generate_title_markdown(grade: number) {
    let md = "#".repeat(grade) + " ";
    for (let i = 2; i <= grade; i++) {
        md += count["h" + i.toString()];
        if (i != grade) {
            md += ".";
        } else {
            if (grade == 2) {
                md += ". ";
            } else {
                md += " ";
            }
        }
    }
    return md;
}

async function delete_title_index(docID: DocumentId) {
    const blocks = await get_type_blockclass(docID, "h");
    for (let data of blocks) {
        let subType = data.subtype ?? "";
        if (subType in count) {
            let md = data.markdown ?? "";
            let md_h = md.match(/^#+ /)![0];
            md = md.replace(md_h, "");
            md = md.replace(/^(\d+(\.\d+)*\.?\s*)*/, "");
            await api.updateBlock("markdown", md_h + md, data["id"]);
        }
    }
}

async function add_title_index(docID: DocumentId) {
    count = { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    const blocks = await get_type_blockclass(docID, "h");
    for (let data of blocks) {
        let subType = data.subtype ?? "";
        let grade = parseInt(subType.match(/\d/)![0]);
        count[subType] += 1;
        for (let i = grade + 1; i < 7; i++) {
            count["h" + i.toString()] = 0;
        }
        let md = data["markdown"];
        md = md.replace(/^#+ /, "");
        md = generate_title_markdown(grade) + md;
        await api.updateBlock("markdown", md, data["id"]);
    }
}

async function get_type_blockclass(
    docID: DocumentId,
    type?: BlockType,
    subType?: BlockSubType,
): Promise<Block[]> {
    const blocks = await api.getChildBlocks(docID);

    if (type === undefined && subType === undefined) return [];
    const blocks_f = blocks.filter((b) => {
        if (type !== undefined && b.type !== type) return false;
        if (subType !== undefined && b.subtype !== subType) return false;
        return true;
    });

    return await Promise.all(blocks_f.map((b) => api.getBlockByID(b.id)));
}
