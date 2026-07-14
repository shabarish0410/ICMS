import sys

def transform_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Wrap the entire return content in <></>
    content = content.replace('return (\n    <div className="space-y-6">', 'return (\n    <>\n    <div className="space-y-6">')
    content = content.replace('      )}\n    </div>\n  );\n}', '      )}\n    </>\n  );\n}')
    
    # Also I removed max-w-7xl mx-auto space-y-6 earlier which had a div wrapper.
    # So I probably have an extra </div> in the code at line 286. 
    # Let me just replace the exact block:
    old_block = """          </div>
        </div>
      </div>

      {/* Confirm Reset Modal */}"""
    new_block = """          </div>
        </div>

      {/* Confirm Reset Modal */}"""
    content = content.replace(old_block, new_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

transform_file('d:/ICMS/frontend/src/app/dashboard/admins/face-management/page.tsx')
