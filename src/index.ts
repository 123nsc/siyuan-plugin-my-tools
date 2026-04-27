import {
    Plugin,
    showMessage,
    getAllEditor,
} from "siyuan";

export default class PluginSample extends Plugin {
    private async remove_bold(blockId: string | undefined) {
        if (!blockId) {
            showMessage("无法获取块 ID");
            return;
        }
        const d = await SYgetBlockKramdown(blockId)
        const lines = d.data.kramdown.split("\n");
        const txt_md = lines.slice(0, -1).join("\n");
        let new_md = txt_md.replace(/\*\*/g, "");
        await SYupdateBlock(new_md, blockId);
        showMessage(blockId+" 已去除加粗");
    }
    // 插件开启时执行
    async onload() {
        console.log("✅ 我的插件加载完成");
    }

    // 思源界面加载完毕后执行
    // 【所有右键菜单、按钮 都写在这里】
    onLayoutReady() {
        // ==========  正文内容 右键菜单 ==========
        this.eventBus.on("open-menu-content", (opts) => {
            const blockElement = opts.detail.element;
            const blockId = blockElement?.dataset.nodeId;

            opts.detail.menu.addItem({
                label: "MY-去除加粗",
                click: () => {
                    this.remove_bold(blockId);
                }
            });
            opts.detail.menu.addItem({
                label: "MY-删除后子块",
                click: () => {
                     if (confirm("确定删除？")) {
                        delete_block_after(blockId);
                        showMessage("✅ 删除成功");
                    }
                }
            });
        });
        // ==========  块 右键菜单 ==========
        this.eventBus.on("click-blockicon", (opts) => {
            const blockElement = opts.detail.blockElements?.[0]; // 取第一个块
            const blockId = blockElement?.dataset.nodeId;

            opts.detail.menu.addItem({
                label: "MY-去除加粗",
                click: () => {
                    this.remove_bold(blockId);
                }
            });
            opts.detail.menu.addItem({
                label: "MY-删除后子块",
                click: () => {
                    if (confirm("确定删除？")) {
                        delete_block_after(blockId);
                        showMessage("✅ 删除成功");
                    }
                }
            });
        });
    }

    // 插件关闭时执行
    async onunload() {
        console.log("❌ 插件已关闭");
    }

    // 插件卸载时执行
    uninstall() {

    }

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
 // 1. 获取块的父块 ID
async function getParentBlock(block_id: string) {
    const result = await SYsql_query(`SELECT parent_id FROM blocks WHERE id = '${block_id}'`);
    if (result["code"] == 0 && result['data']) {
        return result['data'][0].parent_id;
    }
    return null;
}

// 2. 循环向上找，直到拿到【笔记本 ID】
async function getParentNotebook(block_id: string) {
    let s = await getParentBlock(block_id);
    while (s) {
        const pre = s;
        s = await getParentBlock(pre);
        if (!s) {
            return pre;
        }
    }
    return null;
}

// 3. 删除目标块【后面所有同级块】
async function delete_block_after(target_block_id: string) {
    // 获取笔记本 ID
    const parent_id = await getParentNotebook(target_block_id);
    if (!parent_id) return;

    // 获取所有子块
    const d = await SYgetChildBlocks(parent_id)
    let children = d.data;
    const block_ids = children.map(b => b.id);

    // 删除目标块及后面所有块
    const idx = block_ids.indexOf(target_block_id);
    if (idx !== -1) {
        const to_del = block_ids.slice(idx);
        for (const bid of to_del) {
            await SYdeleteBlock(bid)
        }
    }
}
// 思源api
async function SYgetBlockKramdown(id){
    const resp = await fetch("/api/block/getBlockKramdown", {
            method: "POST",
            body: JSON.stringify({
                id: id
            })
        });
    return await resp.json();
}

async function SYupdateBlock(new_md,blockId){
    await fetch("/api/block/updateBlock", {
            method: "POST",
            body: JSON.stringify({"dataType": "markdown", "data": new_md, "id": blockId})
        });
}

async function SYgetChildBlocks(id){
    const resp = await fetch("/api/block/getChildBlocks", {
            method: "POST",
            body: JSON.stringify({
                id: id
            })
        });
    return await resp.json();
}

async function SYdeleteBlock(id){
    await fetch("/api/block/deleteBlock", {
                method: "POST",
                body: JSON.stringify({
                    id: id
                })
            });
}

async function SYsql_query(stmt: string) {
    const resp = await fetch("/api/query/sql", {
            method: "POST",
            body: JSON.stringify({
                stmt: stmt 
            })
        });
    return await resp.json();
}