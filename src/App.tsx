/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-2 text-emerald-400">GuildBot Dashboard</h1>
        <p className="text-zinc-400 mb-8">Discord & Minecraft Integration System</p>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-zinc-200 border-b border-zinc-800 pb-2">Discord Commands</h2>
            <ul className="list-disc list-inside text-zinc-400 space-y-2">
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/verification set</code> - Setup verification channel (Owner only)</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/set guildcreate</code> - Setup guild creation channel (Owner only)</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/set guildlogs</code> - Setup guild logs channel (Owner only)</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/invite @user</code> - Invite a user to your guild</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/join &lt;guildname&gt;</code> - Join a guild</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-zinc-200 border-b border-zinc-800 pb-2">Minecraft Commands</h2>
            <ul className="list-disc list-inside text-zinc-400 space-y-2">
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/getmycode</code> - View your verification code</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/invite &lt;player&gt;</code> - Invite a player to your guild</li>
              <li><code className="text-emerald-300 bg-zinc-800 px-1.5 py-0.5 rounded">/join &lt;guildname&gt;</code> - Join a guild</li>
            </ul>
          </section>

          <section className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
            <h2 className="text-lg font-semibold mb-2 text-zinc-200">Plugin Setup</h2>
            <p className="text-sm text-zinc-400 mb-2">
              The Minecraft plugin source code is located in the <code className="text-zinc-300">/plugin</code> directory.
              Compile it using Maven:
            </p>
            <pre className="bg-zinc-950 p-3 rounded-lg text-sm font-mono text-zinc-300 overflow-x-auto">
              cd plugin{'\n'}mvn clean package
            </pre>
            <p className="text-sm text-zinc-400 mt-2">
              Put the generated <code className="text-zinc-300">GuildBot-1.0-SNAPSHOT.jar</code> in your server's <code className="text-zinc-300">plugins</code> folder.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

