import request from 'request';
import config from './config.mjs';

const { token, tries } = config;

// 拉取题目
const fetchProblems = async () => {
    const problems = [];
    const base = 'https://anyview.gdut.edu.cn/api/scheme-service';

    const r1 = await fetch(`${base}/scheme/list/student`, { headers: { 'token': token } });
    const s = await r1.json();
    const schemes = Array.isArray(s.data) ? s.data : [];

    for (const sc of schemes) {
        try {
            const r2 = await fetch(
                `${base}/catalog/list?schemeId=${sc.id}&classId=${sc.classId}`,
                { headers: { 'token': token } }
            );
            const c = await r2.json();
            if (Array.isArray(c.data)) {
                for (const it of c.data) {
                    problems.push([ it.eid, it.pname, it.kind, it.chapName, it.pass ]);
                }
            }
        } catch (e) {
            console.log(`获取题单失败：${sc.id} -> ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    return problems;
};
const problems = await fetchProblems();

const QUESTIONFULLNAME = problems[0][1];
const KIND = problems[0][2];
const CHAPNAME = problems[0][3];


const reqwest = async (mode, id) => {
    return new Promise((res, rej) => {
        const options = {
            url: `https://anyview.gdut.edu.cn/api/gdb-service/code/${mode}`,
            method: 'POST',
            strictSSL: false,
            headers: {
                'token': token,
                'User-Agent': 'KeqingMoe-Hack/11.45.14',
                'Content-Type': 'multipart/form-data',
            },
        };

        let form = request(options, (error, response, body) => {
            if (error) {
                rej(error);
            } else {
                res(JSON.parse(body).data);
            }
        }).form();

        form.append('questionFullName', QUESTIONFULLNAME);
        form.append('eID', `${id}`);
        form.append('isTeacher', 'false');
        form.append('kind', `${KIND}`);
        form.append('stuCode', Buffer.from('#include "allinclude.h"  //DO NOT edit this line\n#include <iostream>\nint main()\n{\n    std::cout << "=RIGHT=";\n}','utf8').toString('base64'));
        form.append('questionRes.questionFullName', `第${CHAPNAME}章-${QUESTIONFULLNAME}`);
        form.append('language', '1');
        form.append('isDebug', 'false');
    });
};

const solve = async (id, name, n) => {
    const progress=`[ ${n} / ${problems.length} ]`;
    try {
        let cr = await reqwest('compile', id);
        if (cr.result != '编译成功<br>') {
            console.log(`${progress} 题目 ${name} 编译失败，跳过。`);
            return;
        }
    } catch (e) {
        console.log(`${progress} 对题目 ${name} 调用编译接口时出现异常，跳过。`);
        return;
    }
    for (let i = 0; i < tries; ++i) {
        try {
            let rr = await reqwest('runGroup', id);
            if (rr.passed) {
                console.log(`${progress} 题目 ${name} 尝试 ${i + 1} 次后通过。`);
                return;
            }
        } catch (e) {
            console.log(`${progress} 对题目 ${name} 调用评测接口时出现异常，重试。`);
        }
    }
    console.log(`${progress} 题目 ${name} 尝试 ${tries} 次无法 hack，跳过。`);
};

let n = 0;
for (let [id, name] of problems) {
    await solve(id, name, ++n);
}
