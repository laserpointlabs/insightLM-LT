## Capture Operational Notes and Issues Here

### Issues: 

#### UI/UX General Notes:
- The lower and right edges of the application are not clipped to the active window, they extend past- When we popout the Chat to a tab the char view collapses but it should also be set at the bottom of the view containter. 

- When we add a chip to the chat prompt text area the cursor location for text after the chip are off by a few characters tothe left of the actually typed character.

- Viewing the @ commands response is not the best we need the output to be more focused on the object name rather than its refrercne and a nested view might look a little better. We can experiment here for the best of and use cursor and continue.dev as reference.

- After a file is edited by the llm I can see the edits in the actual file in AppData but they dont auto udpate I have to force reload then open close.. (figure this out).

- Chat text area is not working great :( more than a few lines results in a scroll bar, we need the text area to adjuste +lines vertically when we exceed the default 2 lines. 

- The Context in memeory is not clearing or updating the the actual configuration. It looks like there is a local storage holding on the the info, it needs a auto-refresh on change.

- UI needs to remeber the users last layout when opening.

#### Automation / Tabbed UI (observed during MCP UI driving)
- Chat can be open both as a **sidebar view** and a **tab**; selecting the intended target can be confusing/non-deterministic without stable selectors.
- Multiple inputs can be present simultaneously (e.g., Workbooks search, Chat prompt, Notebook code editor). Placeholder-based automation can target the wrong element.
- Recommendation: add stable `data-testid` for:
  - Chat prompt textarea
  - Workbooks search input
  - Active tab header + close button
  - Tab strip + active tab indicator
  - “Send” button
- Some DOM queries via automation can be fragile (depending on routing / focus); prefer deterministic testids + a single canonical Chat input location when possible.

### UI/UX General Notes and Nice-to-Haves 
- I would be nice to allow the tabbed area to be split in half so I can put the chat tab below the other tabs and then open a tab and work with a document with the chat below the doucment. Also the chat should be automatically aware of what document is active so and what documents are open in addition to the scoping.

- Actual spell check integration, currently we see the mispellings but I cannto actually fix this with a helper.

- Need to highlight the quich workbook in the contexts view when selected firht not is is just noted in general. 

- More layout settings for the user similar to cursor or vscode where we can move the insigthLM views to the right or left side of the screen. 

- Hide show individual views, this will come in more handy when we have extensions that may have many possible views.

### LLM Respsones
- The llm is not 


### Jupytre Server
- Can we use the jupyter server as a deterministic numerical solver? (Matlab, scilab?)

### Other MCP Servers
- What other mco servers do we need to better understand the system. 


### Tesing
- [x] Ask llm to create a test file in a particular folder.
- [x] Ask llm to edit the file created. (but not clean... the file is)

### Next Actions (from Jupyter testing session)
- Add deterministic smoke coverage for:
  - Notebook creation in a specific workbook
  - Cell execution that persists into the notebook file (verify the `.ipynb` changed on disk)
  - **Smoke test shape (to implement next)**:
    - Create a new notebook (unique name) in a known workbook
    - Execute a known cell (e.g., `2+2`) and persist outputs into the notebook
    - Assert **Activity** shows `create_notebook` + `execute_cell`
    - Assert on disk that the notebook `.ipynb` contains a code cell with `2+2` and output `4`
- Add `run_jupyter_notebook` (or equivalent) tool to execute an entire notebook deterministically (not just a single cell).
- Consider tool naming clarity:
  - Possibly rename `create_notebook` → `create_jupyter_notebook` (and similarly for execution) **if** this measurably reduces LLM confusion without harming decoupling.
- Fix dev/prod build ergonomics for easy setup.
- Complete deployment + auto remote updates.
- Add a “planning phase” to LLM interactions for complex multi-tool workflows.
- Add details of open/active file(s) into LLM context/history (design: what’s safe + deterministic).
- Store text in chat area between tab changes so partial prompts aren’t lost.

### Idea: MCP “grep” capability
- Consider adding a **grep/search** tool exposed via MCP (or a core tool) so the LLM can quickly locate symbols/strings in the workspace or in workbook documents (scoped + deterministic).