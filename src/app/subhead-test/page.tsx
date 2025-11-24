'use client'

import { useState } from 'react'
import { Rocket } from 'lucide-react'
import {
  Montserrat,
  Inter,
  Work_Sans,
  Manrope,
  Plus_Jakarta_Sans,
  DM_Sans,
  Source_Sans_3,
  Lato,
  Open_Sans,
  Nunito_Sans,
  Karla
} from 'next/font/google'

// Headline font (Montserrat)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['900'] })

// Subhead font options
const montserratSub = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600'] })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] })
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600'] })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '500', '600'] })
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'] })
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })
const nunitoSans = Nunito_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] })
const karla = Karla({ subsets: ['latin'], weight: ['400', '500', '600'] })

const subheadFonts = [
  {
    name: 'Montserrat (Match)',
    font: montserratSub.className,
    weight: 'font-normal',
    note: 'Same family - harmonious but less contrast'
  },
  {
    name: 'Inter',
    font: inter.className,
    weight: 'font-normal',
    note: 'Clean, highly readable - safe pairing'
  },
  {
    name: 'Work Sans',
    font: workSans.className,
    weight: 'font-normal',
    note: 'Modern, friendly - nice contrast with geometric headline'
  },
  {
    name: 'Manrope',
    font: manrope.className,
    weight: 'font-normal',
    note: 'Rounded, warm - softens Montserrat\'s boldness'
  },
  {
    name: 'Plus Jakarta Sans',
    font: plusJakarta.className,
    weight: 'font-normal',
    note: 'Contemporary, sophisticated - elegant pairing'
  },
  {
    name: 'DM Sans',
    font: dmSans.className,
    weight: 'font-normal',
    note: 'Editorial feel - professional but approachable'
  },
  {
    name: 'Source Sans 3',
    font: sourceSans.className,
    weight: 'font-normal',
    note: 'Neutral, clean - lets headline dominate'
  },
  {
    name: 'Lato',
    font: lato.className,
    weight: 'font-normal',
    note: 'Warm, humanist - friendly and readable'
  },
  {
    name: 'Open Sans',
    font: openSans.className,
    weight: 'font-normal',
    note: 'Classic web font - extremely readable'
  },
  {
    name: 'Nunito Sans',
    font: nunitoSans.className,
    weight: 'font-normal',
    note: 'Rounded, casual - friendly and inviting'
  },
  {
    name: 'Karla',
    font: karla.className,
    weight: 'font-normal',
    note: 'Grotesque style - strong personality, good contrast'
  },
]

const weights = [
  { label: 'Regular (400)', value: 'font-normal' },
  { label: 'Medium (500)', value: 'font-medium' },
  { label: 'Semibold (600)', value: 'font-semibold' },
]

export default function SubheadTest() {
  const [selectedFont, setSelectedFont] = useState(0)
  const [selectedWeight, setSelectedWeight] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
      {/* Navigation */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Subheadline Font Comparison</h2>
            <p className="text-sm text-slate-600">Headline: Montserrat Black (locked)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {subheadFonts.map((f, idx) => (
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Weight:</span>
            {weights.map((w, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedWeight(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedWeight === idx
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {w.label}
              </button>
            ))}
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

            {/* Montserrat Headline (locked) */}
            <h1 className={`text-5xl sm:text-7xl font-black text-slate-900 mb-8 leading-tight ${montserrat.className}`}>
              Your network knows where the jobs are.
            </h1>

            {/* Variable Subheadline */}
            <p className={`text-xl sm:text-2xl text-slate-600 mb-16 leading-relaxed ${subheadFonts[selectedFont].font} ${weights[selectedWeight].value}`}>
              Track every contact, conversation, and connection in one place. Because job hunting isn't about applying harder—it's about networking smarter.
            </p>

            <button className="group px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3">
              See Who Can Help You in 30 Seconds
              <Rocket className="w-6 h-6" />
            </button>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Currently viewing:</span> {subheadFonts[selectedFont].name} ({weights[selectedWeight].label})
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {subheadFonts[selectedFont].note}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Fonts Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">All Subheadline Options</h3>
        <div className="grid gap-6">
          {subheadFonts.map((f, idx) => (
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
                  <p className="text-sm text-slate-500 mt-1">{f.note}</p>
                </div>
                {selectedFont === idx && (
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Selected
                  </span>
                )}
              </div>

              {/* Mini preview */}
              <div className="space-y-3">
                <p className={`text-2xl font-black text-slate-900 ${montserrat.className}`}>
                  Your network knows where the jobs are.
                </p>
                <p className={`text-lg text-slate-600 leading-relaxed ${f.font} ${weights[selectedWeight].value}`}>
                  Track every contact, conversation, and connection in one place. Because job hunting isn't about applying harder—it's about networking smarter.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pairing Tips */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Font Pairing Tips with Montserrat:</h3>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>• <strong>For maximum contrast:</strong> Try Karla, Manrope, or Nunito Sans (different personality)</li>
            <li>• <strong>For safe pairing:</strong> Inter, Work Sans, or Source Sans 3 (neutral, readable)</li>
            <li>• <strong>For warmth:</strong> Lato, Open Sans, or Manrope (humanist feel)</li>
            <li>• <strong>For sophistication:</strong> Plus Jakarta Sans or DM Sans (editorial quality)</li>
            <li>• <strong>Weight tip:</strong> Try Medium (500) for better readability at smaller sizes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
