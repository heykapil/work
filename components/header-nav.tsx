'use client'

import { Session } from '@/lib/auth'
import {
  Dialog,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Popover,
  PopoverButton,
  PopoverGroup,
  PopoverPanel,
} from '@headlessui/react'
import { ChevronDownIcon, PhoneIcon } from '@heroicons/react/20/solid'
import {
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { AcademicCapIcon, BookOpenIcon, CalendarIcon, ComputerDesktopIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'

const products = [
  { name: 'Class notes', description: 'Lectures delivered by me in the classes', href: '#', icon: AcademicCapIcon },
  { name: 'E-books & references', description: 'Reference books and other materials', href: '#', icon: BookOpenIcon },
{ name: 'Competitive exams', description: 'Preperation notes by various coaching', href: '#', icon: ComputerDesktopIcon },
]
const callsToAction = [
  { name: 'Currently teaching', href: '#', icon: CalendarIcon },
  { name: 'Report error', href: '#', icon: PhoneIcon },
]

export default function Header({ session }: { session: Session }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openPopOver, setOpenPopOver] = useState(false)
  return (
  <header className="sticky top-0 z-50 w-full border-b border-zinc-100 backdrop-blur-lg bg-background/10">
    <div className="container h-12 mx-auto items-center justify-between">
      <nav aria-label="Global" className="mx-auto flex max-w-5xl items-center justify-between p-2">
        <div className="flex lg:flex-1">
            <img  src='https://cdn.kapil.app/images/website/logos/k.png' alt='Logo' className='h-8 w-auto' />
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>
        </div>
        <PopoverGroup className="hidden lg:flex lg:gap-x-12">
          <Popover className="relative">
            <PopoverButton className="flex items-center gap-x-1 outline-none border-none ring-none" onClick={()=> setOpenPopOver(!openPopOver)}>
              Teaching
              <ChevronDownIcon aria-hidden="true"  className={`size-4 flex-none transition transform-normal duration-150 ${openPopOver ? 'rotate-180' : ''}`} />
            </PopoverButton>

            <PopoverPanel
              transition
              className="absolute left-1/2 z-10 mt-3 w-screen max-w-md -translate-x-1/2 overflow-hidden rounded-3xl bg-white shadow-lg outline-1 outline-gray-900/5 transition data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
            >
              <div className="p-3">
                {products.map((item) => (
                  <div
                    key={item.name}
                    className="group relative flex items-center gap-x-6 rounded-lg p-3 hover:bg-blue-50"
                  >
                    {/*<div className="flex size-11 flex-none items-center justify-center rounded-lg">
                      <item.icon aria-hidden="true" className="size-6 text-gray-600 group-hover:text-blue-600" />
                    </div>*/}
                    <div className="flex-auto group">
                      <a href={item.href} className="block text-gray-700">
                        {item.name}
                        <span className="absolute inset-0" />
                      </a>
                      <span className="mt-1 hidden group-hover:flex group-hover:flex-row group-hover:items-center transition duration-100 transform-ease-in-out text-gray-500">{item.description}
                        <span className="group-hover:animate-fade-left">
                          <svg
                            width="1em"
                            height="1em"
                            fill="none"
                            viewBox="0 0 256 256"
                            className="hidden translate-x-2 rotate-45 transition group-hover:block"
                          >
                            <rect width="256" height="256" fill="none" />
                            <path
                              d="M168,112V100a20,20,0,0,0-40,0V36a20,20,0,0,0-40,0V157.3l-21.9-38a20,20,0,0,0-34.7,20C64,208,83.8,232,128,232a80,80,0,0,0,80-80V112a20,20,0,0,0-40,0Z"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="10"
                            />
                          </svg>
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-900/5 border-t  border-gray-900/5">
                {callsToAction.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="flex items-center justify-center gap-x-2.5 p-3 text-zinc-700 group hover:bg-blue-50"
                  >
                    <item.icon aria-hidden="true" className="size-5 flex-none text-gray-500 group-hover:text-blue-500" />
                    {item.name}
                  </a>
                ))}
              </div>
            </PopoverPanel>
          </Popover>

          <a href="#" className="no-color">
            Research
          </a>
          <a href="#" className="no-color">
            Journals
          </a>
          <a href="#" className="no-color">
            Softwares
          </a>
          <a href="#" className="no-color">
            Collaborate
          </a>
          <a href="#" className="no-color">
            Contact
          </a>
        </PopoverGroup>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <a href="#" className="">
            Log in <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </nav>
      <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white p-2 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div className="flex items-center justify-between">
            <a href="#" className="-m-1.5 p-1.5">
              <span className="sr-only">Your Company</span>
              <img
                alt=""
                src="https://cdn.kapil.app/images/website/logos/k.png"
                className="h-8 w-auto"
              />
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-700"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                <Disclosure as="div" className="-mx-3">
                  <DisclosureButton className="group flex w-full items-center justify-between rounded-lg py-2 pr-3.5 pl-3 text-base/7 font-semibold text-gray-900 hover:bg-gray-50">
                    Product
                    <ChevronDownIcon aria-hidden="true" className="size-5 flex-none group-data-open:rotate-180" />
                  </DisclosureButton>
                  <DisclosurePanel className="mt-2 space-y-2">
                    {[...products, ...callsToAction].map((item) => (
                      <DisclosureButton
                        key={item.name}
                        as="a"
                        href={item.href}
                        className="block rounded-lg py-2 pr-3 pl-6 text-sm/7 font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        {item.name}
                      </DisclosureButton>
                    ))}
                  </DisclosurePanel>
                </Disclosure>
                <a
                  href="#"
                  className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Features
                </a>
                <a
                  href="#"
                  className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Marketplace
                </a>
                <a
                  href="#"
                  className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Company
                </a>
              </div>
              <div className="py-6">
                <a
                  href={session?.user?.username ? 'https://auth.kapil.app/logout?redirectTo=https://work.kapil.app' : 'https://auth.kapil.app/login?redirectTo=https://work.kapil.app'}
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold text-gray-900 hover:bg-gray-50"
                >
                  {session?.user?.username ? 'Log out' : 'Login'}
                </a>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </div>
    </header>
  )
}
