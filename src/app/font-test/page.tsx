'use client'

import { useState } from 'react'
import { Rocket } from 'lucide-react'
import {
  Inter,
  Roboto,
  Montserrat,
  Poppins,
  Space_Grotesk,
  Work_Sans,
  Manrope,
  Plus_Jakarta_Sans,
  DM_Sans,
  Archivo_Black,
  Bebas_Neue,
  Oswald
} from 'next/font/google'

// Load fonts
const inter = Inter({ subsets: ['latin'], weight: ['700', '900'] })
const roboto = Roboto({ subsets: ['latin'], weight: ['700', '900'] })
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '900'] })
const poppins = Poppins({ subsets: ['latin'], weight: ['700', '900'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['700'] })
const workSans = Work_Sans({ subsets: ['latin'], weight: ['700', '900'] })
const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'] })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['700', '900'] })
const archivoBlack = Archivo_Black({ subsets: ['latin'], weight: ['400'] })
const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: ['400'] })
const oswald = Oswald({ subsets: ['latin'], weight: ['700'] })

const fonts = [
  { name: 'Geist (Current)', font: null, weight: 'font-bold' },
  { name: 'Inter', font: inter.className, weight: 'font-black' },
  { name: 'Roboto', font: roboto.className, weight: 'font-black' },
  { name: 'Montserrat', font: montserrat.className, weight: 'font-black' },
  { name: 'Poppins', font: poppins.className, weight: 'font-black' },
  { name: 'Space Grotesk', font: spaceGrotesk.className, weight: 'font-bold' },
  { name: 'Work Sans', font: workSans.className, weight: 'font-black' },
  { name: 'Manrope', font: manrope.className, weight: 'font-extrabold' },
  { name: 'Plus Jakarta Sans', font: plusJakarta.className, weight: 'font-extrabold' },
  { name: 'DM Sans', font: dmSans.className, weight: 'font-black' },
  { name: 'Archivo Black', font: archivoBlack.className, weight: 'font-normal', note: 'Display font - ultra bold' },
  { name: 'Bebas Neue', font: bebasNeue.className, weight: 'font-normal', note: 'Condensed display - very impactful' },
  { name: 'Oswald', font: oswald.className, weight: 'font-bold', note: 'Condensed - strong presence' },
]

export default function FontTest() {
  const [selectedFont, setSelectedFont] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
      {/* Navigation */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Font Comparison</h2>
            <div className="flex gap-2 overflow-x-auto">
              {fonts.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFont(idx)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedFont === idx
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-200/60">
          <div className="text-center">
            <div className="flex justify-center mb-12">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse" />
                <Rocket className="relative w-24 h-24 text-blue-600" strokeWidth={1.5} />
              </div>
            </div>

            <h1 className={`text-5xl sm:text-7xl ${fonts[selectedFont].weight} text-slate-900 mb-8 leading-tight ${fonts[selectedFont].font || ''}`}>
              Your network knows where the jobs are.
            </h1>

            <p className="text-xl sm:text-2xl text-slate-600 mb-16 leading-relaxed">
              Track every contact, conversation, and connection in one place.
            </p>

            <button className="group px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3">
              See Who Can Help You in 30 Seconds
              <Rocket className="w-6 h-6" />
            </button>

            {fonts[selectedFont].note && (
              <p className="mt-8 text-sm text-blue-600 font-medium">
                {fonts[selectedFont].note}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* All Fonts Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">All Options at a Glance</h3>
        <div className="grid gap-8">
          {fonts.map((f, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedFont(idx)}
              className={`bg-white/70 backdrop-blur-sm rounded-xl p-8 border-2 transition-all cursor-pointer ${
                selectedFont === idx
                  ? 'border-blue-600 shadow-xl'
                  : 'border-slate-200/60 hover:border-blue-300 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{f.name}</h4>
                  {f.note && <p className="text-sm text-slate-500 mt-1">{f.note}</p>}
                </div>
                {selectedFont === idx && (
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className={`text-4xl sm:text-5xl ${f.weight} text-slate-900 leading-tight ${f.font || ''}`}>
                Your network knows where the jobs are.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-2">How to use this page:</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Click any font name in the top bar to see full preview</li>
            <li>• Scroll down to compare all options side-by-side</li>
            <li>• Click any card in the grid to preview it</li>
            <li>• Choose the one that feels most impactful for your landing page</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
