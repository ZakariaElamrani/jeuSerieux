/**
 * CodeBuilder - Mini-interpréteur pédagogique (Version Stabilisée v2)
 * Correction boucle infinie + sécurité max itérations
 */
window.App = (() => {
    const levels = [
        {
    id: 1,
    title: "Niveau 1 : Variables & Affichage",
    goal: "Crée une variable `prenom` = 'Zakaria', puis affiche 'Bonjour Zakaria'",
    cmds: [
        { type: 'VAR', code: `prenom = "Zakaria"`, desc: "Créer variable" },
        { type: 'PRINT', code: `afficher "Bonjour"`, desc: "Afficher texte" },
        { type: 'PRINT_VAR', code: `afficher prenom`, desc: "Afficher variable" },
        { type: 'PRINT', code: `afficher "!"`, desc: "Afficher texte" }
    ],
    validate: (out) => out.includes("Bonjour") && out.includes("Zakaria")
}
        ,
        {
            id: 2,
            title: "Niveau 2 : Boucles",
            goal: "Utilise une boucle pour afficher les nombres 1, 2, 3",
            cmds: [
                { type: 'VAR', code: `i = 1`, desc: "Initialiser compteur" },
                { type: 'LOOP_START', code: `repeter 3 fois {`, desc: "Début boucle" },
                { type: 'PRINT_VAR', code: `afficher i`, desc: "Afficher compteur" },
                { type: 'INCREMENT', code: `i = i + 1`, desc: "Incrémenter" },
                { type: 'LOOP_END', code: `}`, desc: "Fin boucle" }
            ],
            validate: (out) => out.includes("1") && out.includes("2") && out.includes("3")
        },
        {
            id: 3,
            title: "Niveau 3 : Conditions",
            goal: "Si `note` >= 10 affiche 'Admis', sinon 'Recalé'. Teste avec note = 12",
            cmds: [
                { type: 'VAR', code: `note = 12`, desc: "Créer variable note" },
                { type: 'IF', code: `si note >= 10 alors {`, desc: "Condition SI" },
                { type: 'PRINT', code: `afficher "Admis"`, desc: "Afficher Admis" },
                { type: 'ELSE', code: `sinon {`, desc: "Sinon" },
                { type: 'PRINT', code: `afficher "Recalé"`, desc: "Afficher Recalé" },
                { type: 'ENDIF', code: `}`, desc: "Fin condition" }
            ],
            validate: (out) => out.includes("Admis") && !out.includes("Recalé")
        }
    ];

    let state = {
        level: 0,
        program: [],
        vars: {},
        output: [],
        ptr: 0,
        running: false,
        stepMode: false,
        loopStack: [],
        skipBlock: false,
        iterCount: 0 // Sécurité anti-boucle infinie
    };

    const $ = id => document.getElementById(id);
    const MAX_ITER = 500; // Limite de sécurité

    const addConsole = (msg) => {
        const el = document.createElement('div');
        el.textContent = `> ${msg}`;
        $('console-output').appendChild(el);
    };

    const renderPalette = () => {
        const lvl = levels[state.level];
        const container = $('cmd-list');
        container.innerHTML = '';
        lvl.cmds.forEach((cmd) => {
            const btn = document.createElement('button');
            btn.className = `cmd-btn ${cmd.type.includes('LOOP') ? 'loop' : cmd.type.includes('IF') || cmd.type.includes('ELSE') ? 'cond' : ''}`;
            btn.textContent = cmd.desc;
            btn.title = cmd.code;
            btn.onclick = () => addCommand(cmd);
            container.appendChild(btn);
        });
        $('level-name').textContent = lvl.title;
    };

    const renderEditor = () => {
        const editor = $('code-editor');
        editor.innerHTML = '';
        if(state.program.length === 0) {
            editor.innerHTML = '<div class="empty-state">Ajoute des commandes ci-dessus...</div>';
            return;
        }
        state.program.forEach((cmd, i) => {
            const line = document.createElement('div');
            line.className = 'code-line';
            line.dataset.idx = i;
            line.innerHTML = `<span>${cmd.code}</span><span class="remove-cmd" data-i="${i}">✕</span>`;
            editor.appendChild(line);
        });
        editor.onclick = (e) => {
            if(e.target.classList.contains('remove-cmd')) {
                e.stopPropagation();
                const idx = parseInt(e.target.dataset.i);
                state.program.splice(idx, 1);
                renderEditor();
            }
        };
    };

    const renderVars = () => {
        const container = $('vars-display');
        container.innerHTML = '';
        if(Object.keys(state.vars).length === 0) {
            container.innerHTML = 'Aucune variable';
            return;
        }
        Object.entries(state.vars).forEach(([k, v]) => {
            const el = document.createElement('div');
            el.className = 'var-item';
            el.innerHTML = `<span class="var-name">${k}</span> = <span class="var-val">${v}</span>`;
            container.appendChild(el);
        });
    };

    const renderConsole = () => {
        const out = $('console-output');
        out.innerHTML = state.output.map(l => `<div>${l}</div>`).join('');
        out.scrollTop = out.scrollHeight;
    };

    const addCommand = (cmd) => {
        if(state.running) return;
        state.program.push({...cmd});
        renderEditor();
    };

    const executeStep = async () => {
        if(state.ptr >= state.program.length) {
            finishExecution();
            return;
        }

        // Sécurité anti-boucle infinie
        state.iterCount++;
        if(state.iterCount > MAX_ITER) {
            addConsole("⚠️ Limite d'itérations atteinte (boucle infinie détectée)");
            state.running = false;
            $('btn-run').disabled = false;
            $('btn-step').disabled = false;
            $('status-badge').textContent = 'Erreur';
            $('status-badge').style.background = 'var(--danger)';
            return;
        }

        const cmd = state.program[state.ptr];
        const lineEl = document.querySelector(`.code-line[data-idx="${state.ptr}"]`);
        if(lineEl) {
            lineEl.classList.add('active');
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        let log = '';
        let advance = true;

        if(state.skipBlock) {
            state.skipBlock = false;
            state.ptr++;
            return executeStep();
        }

        try {
            switch(cmd.type) {
                case 'VAR': {
                    const match = cmd.code.match(/(\w+)\s*=\s*["']?([^"'\s]+)["']?/);
                    if(match) {
                        const val = isNaN(match[2]) ? match[2] : Number(match[2]);
                        state.vars[match[1]] = val;
                        log = `📦 ${match[1]} = ${val}`;
                    }
                    break;
                }
                case 'PRINT': {
                    const match = cmd.code.match(/afficher\s*["'](.+)["']/);
                    if(match) { state.output.push(match[1]); log = `🖨️ ${match[1]}`; }
                    break;
                }
                case 'PRINT_VAR': {
                    const match = cmd.code.match(/afficher\s*(\w+)/);
                    if(match && state.vars[match[1]] !== undefined) {
                        state.output.push(String(state.vars[match[1]]));
                        log = `🖨️ ${state.vars[match[1]]}`;
                    }
                    break;
                }
                case 'INCREMENT': {
                    const match = cmd.code.match(/(\w+)\s*=\s*\1\s*\+\s*(\d+)/);
                    if(match && state.vars[match[1]] !== undefined) {
                        state.vars[match[1]] += Number(match[2]);
                        log = `➕ ${match[1]} devient ${state.vars[match[1]]}`;
                    }
                    break;
                }
                case 'LOOP_START': {
                    const match = cmd.code.match(/repeter\s+(\d+)\s*fois/);
                    if(match) {
                        state.loopStack.push({ ptr: state.ptr, count: Number(match[1]), current: 0 });
                        log = `🔁 Début boucle (${match[1]}x)`;
                    }
                    break;
                }
                case 'LOOP_END': {
                    if(state.loopStack.length > 0) {
                        const loop = state.loopStack[state.loopStack.length - 1];
                        loop.current++;
                        if(loop.current < loop.count) {
                            // ✅ CORRECTION : Sauter vers la commande APRÈS LOOP_START
                            state.ptr = loop.ptr + 1;
                            log = `🔁 Retour boucle (${loop.current}/${loop.count})`;
                            advance = false;
                        } else {
                            state.loopStack.pop();
                            log = `🏁 Fin boucle`;
                        }
                    }
                    break;
                }
                case 'IF': {
                    const match = cmd.code.match(/si\s+(\w+)\s*([><=!]+)\s*(\d+)/);
                    if(match) {
                        const val = state.vars[match[1]];
                        const op = match[2];
                        const target = Number(match[3]);
                        let cond = false;
                        if(op === '>=') cond = val >= target;
                        if(op === '<=') cond = val <= target;
                        if(!cond) { log = `❌ Condition fausse → saut`; state.skipBlock = true; }
                        else { log = `✅ Condition vraie → exécute`; }
                    }
                    break;
                }
                case 'ELSE': {
                    state.skipBlock = true;
                    log = `⏭️ Ignore SINON`;
                    break;
                }
                case 'ENDIF': { log = `🏁 Fin condition`; break; }
            }
        } catch(e) {
            log = `⚠️ Erreur: ${e.message}`;
        }

        if(log) addConsole(log);
        renderVars();
        renderConsole();
        
        if(lineEl) setTimeout(() => lineEl.classList.remove('active'), 300);
        if(advance) state.ptr++;
        
        await new Promise(r => setTimeout(r, 400));
        if(state.running || state.stepMode) executeStep();
    };

    const finishExecution = () => {
    state.running = false;
    state.stepMode = false;
    $('btn-run').disabled = false;
    $('btn-step').disabled = false;
    $('status-badge').textContent = 'Terminé';
    $('status-badge').style.background = 'var(--success)';
    $('status-badge').style.color = '#0f172a';

    const fb = $('feedback-area');
    fb.classList.remove('hidden');
    const lvl = levels[state.level];
    const success = lvl.validate(state.output.join('\n'), state.vars);
    
    fb.className = `feedback ${success ? 'success' : 'fail'}`;

    // ✅ CORRECTION : Bouton adaptatif selon le niveau
    let actionBtn = '';
    if (success) {
        if (state.level < levels.length - 1) {
            actionBtn = `<button class="btn-run" style="margin-top:0.5rem; width:100%" onclick="window.App.nextLevel()">➡️ Niveau suivant</button>`;
        } else {
            actionBtn = `<button class="btn-run" style="margin-top:0.5rem; width:100%" onclick="window.App.finishGame()">🏆 Mission terminée !</button>`;
        }
    }

    fb.innerHTML = `
        <h4>${success ? '✅ Programme correct !' : '⚠️ Résultat attendu non atteint'}</h4>
        <p>${success ? 'Bravo ! L\'objectif est validé.' : 'Vérifie l\'ordre, les variables ou la logique. Réessaie !'}</p>
        ${actionBtn}
    `;
};

    const loadLevel = () => {
        state.program = [];
        state.vars = {};
        state.output = [];
        state.ptr = 0;
        state.running = false;
        state.loopStack = [];
        state.skipBlock = false;
        state.iterCount = 0;
        
        renderPalette();
        renderEditor();
        renderVars();
        $('console-output').innerHTML = '';
        $('feedback-area').classList.add('hidden');
        $('btn-run').disabled = false;
        $('btn-step').disabled = false;
        $('status-badge').textContent = 'Prêt';
        $('status-badge').style.background = 'var(--border)';
        $('status-badge').style.color = 'var(--text)';
    };

    return {
        start: () => { state.level = 0; loadLevel(); },
        nextLevel: () => { state.level++; loadLevel(); },
        resetLevel: () => loadLevel(),
        clear: () => { state.program = []; renderEditor(); },
        run: () => {
            if(state.program.length === 0) return;
            state.running = true; state.stepMode = false; state.ptr = 0;
            state.vars = {}; state.output = []; state.loopStack = []; state.skipBlock = false; state.iterCount = 0;
            $('console-output').innerHTML = ''; $('feedback-area').classList.add('hidden');
            $('btn-run').disabled = true; $('btn-step').disabled = true;
            $('status-badge').textContent = 'Exécution...'; $('status-badge').style.background = 'var(--warning)';
            executeStep();
        },
        step: () => {
            if(state.program.length === 0) return;
            if(!state.running) {
                state.running = true; state.stepMode = true; state.ptr = 0;
                state.vars = {}; state.output = []; state.loopStack = []; state.skipBlock = false; state.iterCount = 0;
                $('console-output').innerHTML = ''; $('feedback-area').classList.add('hidden');
                $('status-badge').textContent = 'Pas à pas';
            }
            executeStep();
        },
            finishGame: () => {
        // Réinitialise proprement et affiche un message de fin
        alert("🎉 Félicitations Zakaria ! Tu as complété les 3 niveaux. Tu maîtrises les bases de la programmation !");
        App.start();
    },
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    if(window.App) window.App.start();
});