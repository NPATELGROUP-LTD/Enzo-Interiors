Want this style just different photo and text for hero section 



"

Installation: npx shadcn@latest add https://21st.dev/r/lovesickfromthe6ix/full-screen-scroll-fx

How to use: 
import React from "react";

import { FullScreenScrollFX, FullScreenFXAPI } from "@/components/ui/full-screen-scroll-fx";





const sections = \[

&nbsp; {

&nbsp;   leftLabel: "Silence",

&nbsp;   title: <>Absence</>,

&nbsp;   rightLabel: "Silence",

&nbsp;   background: "https://images.pexels.com/photos/3289156/pexels-photo-3289156.jpeg?cs=srgb\&dl=pexels-alexfu-3289156.jpg\&fm=jpg\&\_gl=1\*1acr8i7\*\_ga\*MTI3MjA2NDU0Mi4xNzU1NzM3ODI5\*\_ga\_8JE65Q40S6\*czE3NTU3NjkyMzgkbzMkZzEkdDE3NTU3Njk1MTckajYwJGwwJGgw",

&nbsp;   audioSrc: "/sfx/click-01.mp3",

&nbsp; },

&nbsp; {

&nbsp;   leftLabel: "Essence",

&nbsp;   title: <>Stillness</>,

&nbsp;   rightLabel: "Essence",

&nbsp;   background: "https://images.pexels.com/photos/163790/at-night-under-a-lantern-guy-night-city-163790.jpeg",

&nbsp;   audioSrc: "/sfx/whoosh-02.mp3",

&nbsp; },

&nbsp; {

&nbsp;   leftLabel: "Rebirth",

&nbsp;   title: <>Growth</>,

&nbsp;   rightLabel: "Rebirth",

&nbsp;   background: "https://images.pexels.com/photos/9817/pexels-photo-9817.jpeg",

&nbsp;   audioSrc: "/sfx/whoosh-02.mp3",

&nbsp; },

&nbsp; {

&nbsp;   leftLabel: "Change",

&nbsp;   title: <>Opportunity</>,

&nbsp;   rightLabel: "Change",

&nbsp;   background: "https://images.pexels.com/photos/939807/pexels-photo-939807.jpeg",

&nbsp;   audioSrc: "/sfx/whoosh-02.mp3",

&nbsp; },

&nbsp; // ...

];



export default function DemoOne() {

&nbsp; const apiRef = React.useRef<FullScreenFXAPI>(null);



&nbsp; return (

&nbsp;   <>

&nbsp;     <FullScreenScrollFX

&nbsp;       sections={ sections }

&nbsp;       header={<><div>The Creative</div><div>Process</div></>}

&nbsp;       footer={<div></div>}

&nbsp;       showProgress

&nbsp;       durations={{ change: 0.7, snap: 800 }}

&nbsp;     />

&nbsp;   </>

&nbsp; );

}

"

Want hero section tag line as this 
" Installation: npx shadcn@latest add https://21st.dev/r/danielpetho/text-rotate"
" how to use: 

"use client"



import { LayoutGroup, motion } from "motion/react"



import { TextRotate } from "@/components/ui/text-rotate"



function Preview() {

&nbsp; return (

&nbsp;   <div className="w-full h-full text-2xl sm:text-3xl md:text-5xl flex flex-row items-center justify-center font-overusedGrotesk bg-white dark:text-muted text-foreground font-light overflow-hidden p-12 sm:p-20 md:p-24">

&nbsp;     <LayoutGroup>

&nbsp;       <motion.p className="flex whitespace-pre" layout>

&nbsp;         <motion.span

&nbsp;           className="pt-0.5 sm:pt-1 md:pt-2"

&nbsp;           layout

&nbsp;           transition={{ type: "spring", damping: 30, stiffness: 400 }}

&nbsp;         >

&nbsp;           Make it{" "}

&nbsp;         </motion.span>

&nbsp;         <TextRotate

&nbsp;           texts={\[

&nbsp;             "work!",

&nbsp;             "fancy ✽",

&nbsp;             "right",

&nbsp;             "fast",

&nbsp;             "fun",

&nbsp;             "rock",

&nbsp;             "🕶️🕶️🕶️",

&nbsp;           ]}

&nbsp;           mainClassName="text-white px-2 sm:px-2 md:px-3 bg-\[#ff5941] overflow-hidden py-0.5 sm:py-1 md:py-2 justify-center rounded-lg"

&nbsp;           staggerFrom={"last"}

&nbsp;           initial={{ y: "100%" }}

&nbsp;           animate={{ y: 0 }}

&nbsp;           exit={{ y: "-120%" }}

&nbsp;           staggerDuration={0.025}

&nbsp;           splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"

&nbsp;           transition={{ type: "spring", damping: 30, stiffness: 400 }}

&nbsp;           rotationInterval={2000}

&nbsp;         />

&nbsp;       </motion.p>

&nbsp;     </LayoutGroup>

&nbsp;   </div>

&nbsp; )

}



export { Preview }

"


For testimonials want this 


"Installation: npx shadcn@latest add https://21st.dev/r/sshahaider/testimonials-columns-1"
"How to use:
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";

import { motion } from "motion/react";



const testimonials = \[

&nbsp; {

&nbsp;   text: "This ERP revolutionized our operations, streamlining finance and inventory. The cloud-based platform keeps us productive, even remotely.",

&nbsp;   image: "https://randomuser.me/api/portraits/women/1.jpg",

&nbsp;   name: "Briana Patton",

&nbsp;   role: "Operations Manager",

&nbsp; },

&nbsp; {

&nbsp;   text: "Implementing this ERP was smooth and quick. The customizable, user-friendly interface made team training effortless.",

&nbsp;   image: "https://randomuser.me/api/portraits/men/2.jpg",

&nbsp;   name: "Bilal Ahmed",

&nbsp;   role: "IT Manager",

&nbsp; },

&nbsp; {

&nbsp;   text: "The support team is exceptional, guiding us through setup and providing ongoing assistance, ensuring our satisfaction.",

&nbsp;   image: "https://randomuser.me/api/portraits/women/3.jpg",

&nbsp;   name: "Saman Malik",

&nbsp;   role: "Customer Support Lead",

&nbsp; },

&nbsp; {

&nbsp;   text: "This ERP's seamless integration enhanced our business operations and efficiency. Highly recommend for its intuitive interface.",

&nbsp;   image: "https://randomuser.me/api/portraits/men/4.jpg",

&nbsp;   name: "Omar Raza",

&nbsp;   role: "CEO",

&nbsp; },

&nbsp; {

&nbsp;   text: "Its robust features and quick support have transformed our workflow, making us significantly more efficient.",

&nbsp;   image: "https://randomuser.me/api/portraits/women/5.jpg",

&nbsp;   name: "Zainab Hussain",

&nbsp;   role: "Project Manager",

&nbsp; },

&nbsp; {

&nbsp;   text: "The smooth implementation exceeded expectations. It streamlined processes, improving overall business performance.",

&nbsp;   image: "https://randomuser.me/api/portraits/women/6.jpg",

&nbsp;   name: "Aliza Khan",

&nbsp;   role: "Business Analyst",

&nbsp; },

&nbsp; {

&nbsp;   text: "Our business functions improved with a user-friendly design and positive customer feedback.",

&nbsp;   image: "https://randomuser.me/api/portraits/men/7.jpg",

&nbsp;   name: "Farhan Siddiqui",

&nbsp;   role: "Marketing Director",

&nbsp; },

&nbsp; {

&nbsp;   text: "They delivered a solution that exceeded expectations, understanding our needs and enhancing our operations.",

&nbsp;   image: "https://randomuser.me/api/portraits/women/8.jpg",

&nbsp;   name: "Sana Sheikh",

&nbsp;   role: "Sales Manager",

&nbsp; },

&nbsp; {

&nbsp;   text: "Using this ERP, our online presence and conversions significantly improved, boosting business performance.",

&nbsp;   image: "https://randomuser.me/api/portraits/men/9.jpg",

&nbsp;   name: "Hassan Ali",

&nbsp;   role: "E-commerce Manager",

&nbsp; },

];





const firstColumn = testimonials.slice(0, 3);

const secondColumn = testimonials.slice(3, 6);

const thirdColumn = testimonials.slice(6, 9);





const Testimonials = () => {

&nbsp; return (

&nbsp;   <section className="bg-background my-20 relative">



&nbsp;     <div className="container z-10 mx-auto">

&nbsp;       <motion.div

&nbsp;         initial={{ opacity: 0, y: 20 }}

&nbsp;         whileInView={{ opacity: 1, y: 0 }}

&nbsp;         transition={{ duration: 0.8, delay: 0.1, ease: \[0.16, 1, 0.3, 1] }}

&nbsp;         viewport={{ once: true }}

&nbsp;         className="flex flex-col items-center justify-center max-w-\[540px] mx-auto"

&nbsp;       >

&nbsp;         <div className="flex justify-center">

&nbsp;           <div className="border py-1 px-4 rounded-lg">Testimonials</div>

&nbsp;         </div>



&nbsp;         <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5">

&nbsp;           What our users say

&nbsp;         </h2>

&nbsp;         <p className="text-center mt-5 opacity-75">

&nbsp;           See what our customers have to say about us.

&nbsp;         </p>

&nbsp;       </motion.div>



&nbsp;       <div className="flex justify-center gap-6 mt-10 \[mask-image:linear-gradient(to\_bottom,transparent,black\_25%,black\_75%,transparent)] max-h-\[740px] overflow-hidden">

&nbsp;         <TestimonialsColumn testimonials={firstColumn} duration={15} />

&nbsp;         <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />

&nbsp;         <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />

&nbsp;       </div>

&nbsp;     </div>

&nbsp;   </section>

&nbsp; );

};



export default { Testimonials };
"


For footer want this



"Installation: npx shadcn@latest add https://21st.dev/r/mdafsarx/hover-footer"
"how to use:

"use client";

import React from "react";

import {

&nbsp; Mail,

&nbsp; Phone,

&nbsp; MapPin,

&nbsp; Facebook,

&nbsp; Instagram,

&nbsp; Twitter,

&nbsp; Dribbble,

&nbsp; Globe,

} from "lucide-react";

import {FooterBackgroundGradient} from "@/components/ui/hover-footer";

import { TextHoverEffect } from "@/components/ui/hover-footer";



function HoverFooter() {

&nbsp; // Footer link data

&nbsp; const footerLinks = \[

&nbsp;   {

&nbsp;     title: "About Us",

&nbsp;     links: \[

&nbsp;       { label: "Company History", href: "#" },

&nbsp;       { label: "Meet the Team", href: "#" },

&nbsp;       { label: "Employee Handbook", href: "#" },

&nbsp;       { label: "Careers", href: "#" },

&nbsp;     ],

&nbsp;   },

&nbsp;   {

&nbsp;     title: "Helpful Links",

&nbsp;     links: \[

&nbsp;       { label: "FAQs", href: "#" },

&nbsp;       { label: "Support", href: "#" },

&nbsp;       {

&nbsp;         label: "Live Chat",

&nbsp;         href: "#",

&nbsp;         pulse: true,

&nbsp;       },

&nbsp;     ],

&nbsp;   },

&nbsp; ];



&nbsp; // Contact info data

&nbsp; const contactInfo = \[

&nbsp;   {

&nbsp;     icon: <Mail size={18} className="text-\[#3ca2fa]" />,

&nbsp;     text: "hello@nurui.com",

&nbsp;     href: "mailto:hello@nurui.com",

&nbsp;   },

&nbsp;   {

&nbsp;     icon: <Phone size={18} className="text-\[#3ca2fa]" />,

&nbsp;     text: "+91 86373 73116",

&nbsp;     href: "tel:+918637373116",

&nbsp;   },

&nbsp;   {

&nbsp;     icon: <MapPin size={18} className="text-\[#3ca2fa]" />,

&nbsp;     text: "Sylhet, Bangladesh",

&nbsp;   },

&nbsp; ];



&nbsp; // Social media icons

&nbsp; const socialLinks = \[

&nbsp;   { icon: <Facebook size={20} />, label: "Facebook", href: "#" },

&nbsp;   { icon: <Instagram size={20} />, label: "Instagram", href: "#" },

&nbsp;   { icon: <Twitter size={20} />, label: "Twitter", href: "#" },

&nbsp;   { icon: <Dribbble size={20} />, label: "Dribbble", href: "#" },

&nbsp;   { icon: <Globe size={20} />, label: "Globe", href: "#" },

&nbsp; ];



&nbsp; return (

&nbsp;   <footer className="bg-\[#0F0F11]/10 relative h-fit rounded-3xl overflow-hidden m-8">

&nbsp;     <div className="max-w-7xl mx-auto p-14 z-40 relative">

&nbsp;       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8 lg:gap-16 pb-12">

&nbsp;         {/\* Brand section \*/}

&nbsp;         <div className="flex flex-col space-y-4">

&nbsp;           <div className="flex items-center space-x-2">

&nbsp;             <span className="text-\[#3ca2fa] text-3xl font-extrabold">

&nbsp;               \&hearts;

&nbsp;             </span>

&nbsp;             <span className="text-white text-3xl font-bold">Nur/ui</span>

&nbsp;           </div>

&nbsp;           <p className="text-sm leading-relaxed">

&nbsp;             Nur UI is a modern React and Next.js based UI component library.

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         {/\* Footer link sections \*/}

&nbsp;         {footerLinks.map((section) => (

&nbsp;           <div key={section.title}>

&nbsp;             <h4 className="text-white text-lg font-semibold mb-6">

&nbsp;               {section.title}

&nbsp;             </h4>

&nbsp;             <ul className="space-y-3">

&nbsp;               {section.links.map((link) => (

&nbsp;                 <li key={link.label} className="relative">

&nbsp;                   <a

&nbsp;                     href={link.href}

&nbsp;                     className="hover:text-\[#3ca2fa] transition-colors"

&nbsp;                   >

&nbsp;                     {link.label}

&nbsp;                   </a>

&nbsp;                   {link.pulse \&\& (

&nbsp;                     <span className="absolute top-0 right-\[-10px] w-2 h-2 rounded-full bg-\[#3ca2fa] animate-pulse"></span>

&nbsp;                   )}

&nbsp;                 </li>

&nbsp;               ))}

&nbsp;             </ul>

&nbsp;           </div>

&nbsp;         ))}



&nbsp;         {/\* Contact section \*/}

&nbsp;         <div>

&nbsp;           <h4 className="text-white text-lg font-semibold mb-6">

&nbsp;             Contact Us

&nbsp;           </h4>

&nbsp;           <ul className="space-y-4">

&nbsp;             {contactInfo.map((item, i) => (

&nbsp;               <li key={i} className="flex items-center space-x-3">

&nbsp;                 {item.icon}

&nbsp;                 {item.href ? (

&nbsp;                   <a

&nbsp;                     href={item.href}

&nbsp;                     className="hover:text-\[#3ca2fa] transition-colors"

&nbsp;                   >

&nbsp;                     {item.text}

&nbsp;                   </a>

&nbsp;                 ) : (

&nbsp;                   <span className="hover:text-\[#3ca2fa] transition-colors">

&nbsp;                     {item.text}

&nbsp;                   </span>

&nbsp;                 )}

&nbsp;               </li>

&nbsp;             ))}

&nbsp;           </ul>

&nbsp;         </div>

&nbsp;       </div>



&nbsp;       <hr className="border-t border-gray-700 my-8" />



&nbsp;       {/\* Footer bottom \*/}

&nbsp;       <div className="flex flex-col md:flex-row justify-between items-center text-sm space-y-4 md:space-y-0">

&nbsp;         {/\* Social icons \*/}

&nbsp;         <div className="flex space-x-6 text-gray-400">

&nbsp;           {socialLinks.map(({ icon, label, href }) => (

&nbsp;             <a

&nbsp;               key={label}

&nbsp;               href={href}

&nbsp;               aria-label={label}

&nbsp;               className="hover:text-\[#3ca2fa] transition-colors"

&nbsp;             >

&nbsp;               {icon}

&nbsp;             </a>

&nbsp;           ))}

&nbsp;         </div>



&nbsp;         {/\* Copyright \*/}

&nbsp;         <p className="text-center md:text-left">

&nbsp;           \&copy; {new Date().getFullYear()} Nurui. All rights reserved.

&nbsp;         </p>

&nbsp;       </div>

&nbsp;     </div>



&nbsp;     {/\* Text hover effect \*/}

&nbsp;     <div className="lg:flex hidden h-\[30rem] -mt-52 -mb-36">

&nbsp;       <TextHoverEffect text="Nurui" className="z-50" />

&nbsp;     </div>



&nbsp;     <FooterBackgroundGradient />

&nbsp;   </footer>

&nbsp; );

}



export default HoverFooter;"


For 404 page want this



"Installation: npx shadcn@latest add https://21st.dev/r/minhxthanh/page-not-found"
"How to use: 

import NotFoundPage from "@/components/ui/page-not-found";



const DemoOne = () => {

&nbsp; return (

&nbsp;   <div className="flex w-full h-screen justify-center items-center">

&nbsp;     <NotFoundPage />

&nbsp;   </div>

&nbsp; );

};



export { DemoOne };

"



For Navbar hamburger want this

"Installation: npx shadcn@latest add https://21st.dev/r/sshahaider/menu-toggle-icon"
"how to use:

import React from 'react';

import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";



export default function DemoOne() {



&nbsp; const \[open, setOpen] = React.useState(false);



&nbsp;	return (

&nbsp;		<button onClick={() => setOpen(!open)}>

&nbsp;			<MenuToggleIcon open={open} className="size-20" duration={500} />

&nbsp;		</button>

&nbsp;	);

}

"


For Footer / Contact page want this 

"Installation: npx shadcn@latest add https://21st.dev/r/jatin-yadav05/social-icons"
"How to use:
import { SocialIcons } from "@/components/ui/social-icons";



export default function Page() {

&nbsp; return (

&nbsp;   <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-900 w-full">

&nbsp;     <div className="flex flex-col items-center gap-12">

&nbsp;       <div className="text-center space-y-2">

&nbsp;         <h1 className="text-2xl font-semibold tracking-tight text-white">Connect with me</h1>

&nbsp;         <p className="text-sm text-neutral-400">Hover over the icons below</p>

&nbsp;       </div>



&nbsp;       <SocialIcons />

&nbsp;     </div>

&nbsp;   </main>

&nbsp; )

}

"


For Blog / Inspiration page Want this

"Installation: npx shadcn@latest add https://21st.dev/r/aceternity/link-preview"
"how to use:

"use client";

import React from "react";

import { LinkPreview } from "@/components/ui/link-preview";



export function LinkPreviewDemoSecond() {

&nbsp; return (

&nbsp;   <div className="flex justify-center items-start h-\[40rem] flex-col px-4">

&nbsp;     <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left mb-10">

&nbsp;       Visit{" "}

&nbsp;       <LinkPreview

&nbsp;         url="https://ui.aceternity.com"

&nbsp;         className="font-bold bg-clip-text text-transparent bg-gradient-to-br from-purple-500 to-pink-500"

&nbsp;       >

&nbsp;         Aceternity UI

&nbsp;       </LinkPreview>{" "}

&nbsp;       and for amazing Tailwind and Framer Motion components.

&nbsp;     </p>



&nbsp;     <p className="text-neutral-500 dark:text-neutral-400 text-xl md:text-3xl max-w-3xl  text-left ">

&nbsp;       I listen to{" "}

&nbsp;       <LinkPreview

&nbsp;         url="https://www.youtube.com/watch?v=S-z6vyR89Ig\&list=RDMM\&index=3"

&nbsp;         imageSrc="https://ui.aceternity.com/\_next/image?url=%2Fimages%2Fimraan-hashmi.jpeg\&w=640\&q=50"

&nbsp;         isStatic

&nbsp;         className="font-bold"

&nbsp;       >

&nbsp;         this guy

&nbsp;       </LinkPreview>{" "}

&nbsp;       and I watch{" "}

&nbsp;       <LinkPreview

&nbsp;         url="/templates"

&nbsp;         imageSrc="https://ui.aceternity.com/\_next/image?url=%2Fimages%2Ffight-club.jpeg\&w=640\&q=50"

&nbsp;         isStatic

&nbsp;         className="font-bold"

&nbsp;       >

&nbsp;         this movie

&nbsp;       </LinkPreview>{" "}

&nbsp;       twice a day

&nbsp;     </p>

&nbsp;   </div>

&nbsp; );

}

"

For Site-wide notifications want this 
"Installation: npx shadcn@latest add https://21st.dev/r/shugar/toast"
"How to use: import { useToasts } from "@/components/ui/toast";

import { Button } from "@/components/ui/button-1";



export default function DefaultDemo() {

&nbsp; const toasts = useToasts();

&nbsp; return (

&nbsp;       <Button

&nbsp;         onClick={(): void => {

&nbsp;           toasts.message({

&nbsp;             text: `The Evil Rabbit jumped over the fence.`

&nbsp;           });

&nbsp;         }}

&nbsp;       >

&nbsp;         Show Toast

&nbsp;       </Button>

&nbsp; );

}

"

For client portal dock want this

"installation: npx shadcn@latest add https://21st.dev/r/anurag-mishra22/dock-two"
"how to use: 

import { Dock } from "@/components/ui/dock-two"

import {

&nbsp; Home,

&nbsp; Search,

&nbsp; Music,

&nbsp; Heart,

&nbsp; Settings,

&nbsp; Plus,

&nbsp; User

} from "lucide-react"



function DockDemo() {

&nbsp; const items = \[

&nbsp;   { icon: Home, label: "Home" },

&nbsp;   { icon: Search, label: "Search" },

&nbsp;   { icon: Music, label: "Music" },

&nbsp;   { icon: Heart, label: "Favorites" },

&nbsp;   { icon: Plus, label: "Add New" },

&nbsp;   { icon: User, label: "Profile" },

&nbsp;   { icon: Settings, label: "Settings" }

&nbsp; ]



&nbsp; return <Dock items={items} />

}



export  { DockDemo } "


For Portal login page want this

"Installation: npx shadcn@latest add https://21st.dev/r/preetsuthar17/full-screen-signup"
"How to use:



// This is a demo of a preview

// That's what users will see in the preview



import { FullScreenSignup } from "@/components/ui/full-screen-signup";



const DemoOne = () => {

&nbsp; return <FullScreenSignup />;

};



// IMPORTANT:

// format of the export MUST be export default { DemoOneOrOtherName }

// if you don't do this, the demo will not be shown

export default { DemoOne };

"

For Portal context/action menu want this



"Instalaltion: 	npx shadcn@latest add https://21st.dev/r/dillionverma/interactive-hover-button"
"how to use: 

import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";





function InteractiveHoverButtonDemo() {

&nbsp; return (

&nbsp;   <div className="relative justify-center">

&nbsp;     <InteractiveHoverButton />

&nbsp;   </div>

&nbsp; );

}



export { InteractiveHoverButtonDemo };"


For Portal Loading or Empty States want this kind of animation page but don't want button in middle 

"Instalaltion:  npx shadcn@latest add https://21st.dev/r/aceternity/pulse-beams"
"how to use: 

"use client";



import { PulseBeams } from "@/components/ui/pulse-beams";



const beams = \[

&nbsp; {

&nbsp;   path: "M269 220.5H16.5C10.9772 220.5 6.5 224.977 6.5 230.5V398.5",

&nbsp;   gradientConfig: {

&nbsp;     initial: {

&nbsp;       x1: "0%",

&nbsp;       x2: "0%",

&nbsp;       y1: "80%",

&nbsp;       y2: "100%",

&nbsp;     },

&nbsp;     animate: {

&nbsp;       x1: \["0%", "0%", "200%"],

&nbsp;       x2: \["0%", "0%", "180%"],

&nbsp;       y1: \["80%", "0%", "0%"],

&nbsp;       y2: \["100%", "20%", "20%"],

&nbsp;     },

&nbsp;     transition: {

&nbsp;       duration: 2,

&nbsp;       repeat: Infinity,

&nbsp;       repeatType: "loop",

&nbsp;       ease: "linear",

&nbsp;       repeatDelay: 2,

&nbsp;       delay: Math.random() \* 2,

&nbsp;     },

&nbsp;   },

&nbsp;   connectionPoints: \[

&nbsp;     { cx: 6.5, cy: 398.5, r: 6 },

&nbsp;     { cx: 269, cy: 220.5, r: 6 }

&nbsp;   ]

&nbsp; },

&nbsp; {

&nbsp;   path: "M568 200H841C846.523 200 851 195.523 851 190V40",

&nbsp;   gradientConfig: {

&nbsp;     initial: {

&nbsp;       x1: "0%",

&nbsp;       x2: "0%",

&nbsp;       y1: "80%",

&nbsp;       y2: "100%",

&nbsp;     },

&nbsp;     animate: {

&nbsp;       x1: \["20%", "100%", "100%"],

&nbsp;       x2: \["0%", "90%", "90%"],

&nbsp;       y1: \["80%", "80%", "-20%"],

&nbsp;       y2: \["100%", "100%", "0%"],

&nbsp;     },

&nbsp;     transition: {

&nbsp;       duration: 2,

&nbsp;       repeat: Infinity,

&nbsp;       repeatType: "loop",

&nbsp;       ease: "linear",

&nbsp;       repeatDelay: 2,

&nbsp;       delay: Math.random() \* 2,

&nbsp;     },

&nbsp;   },

&nbsp;   connectionPoints: \[

&nbsp;     { cx: 851, cy: 34, r: 6.5 },

&nbsp;     { cx: 568, cy: 200, r: 6 }

&nbsp;   ]

&nbsp; },

&nbsp; {

&nbsp;   path: "M425.5 274V333C425.5 338.523 421.023 343 415.5 343H152C146.477 343 142 347.477 142 353V426.5",

&nbsp;   gradientConfig: {

&nbsp;     initial: {

&nbsp;       x1: "0%",

&nbsp;       x2: "0%",

&nbsp;       y1: "80%",

&nbsp;       y2: "100%",

&nbsp;     },

&nbsp;     animate: {

&nbsp;       x1: \["20%", "100%", "100%"],

&nbsp;       x2: \["0%", "90%", "90%"],

&nbsp;       y1: \["80%", "80%", "-20%"],

&nbsp;       y2: \["100%", "100%", "0%"],

&nbsp;     },

&nbsp;     transition: {

&nbsp;       duration: 2,

&nbsp;       repeat: Infinity,

&nbsp;       repeatType: "loop",

&nbsp;       ease: "linear",

&nbsp;       repeatDelay: 2,

&nbsp;       delay: Math.random() \* 2,

&nbsp;     },

&nbsp;   },

&nbsp;   connectionPoints: \[

&nbsp;     { cx: 142, cy: 427, r: 6.5 },

&nbsp;     { cx: 425.5, cy: 274, r: 6 }

&nbsp;   ]

&nbsp; },

&nbsp; {

&nbsp;   path: "M493 274V333.226C493 338.749 497.477 343.226 503 343.226H760C765.523 343.226 770 347.703 770 353.226V427",

&nbsp;   gradientConfig: {

&nbsp;     initial: {

&nbsp;       x1: "40%",

&nbsp;       x2: "50%",

&nbsp;       y1: "160%",

&nbsp;       y2: "180%",

&nbsp;     },

&nbsp;     animate: {

&nbsp;       x1: "0%",

&nbsp;       x2: "10%",

&nbsp;       y1: "-40%",

&nbsp;       y2: "-20%",

&nbsp;     },

&nbsp;     transition: {

&nbsp;       duration: 2,

&nbsp;       repeat: Infinity,

&nbsp;       repeatType: "loop",

&nbsp;       ease: "linear",

&nbsp;       repeatDelay: 2,

&nbsp;       delay: Math.random() \* 2,

&nbsp;     },

&nbsp;   },

&nbsp;   connectionPoints: \[

&nbsp;     { cx: 770, cy: 427, r: 6.5 },

&nbsp;     { cx: 493, cy: 274, r: 6 }

&nbsp;   ]

&nbsp; },

&nbsp; {

&nbsp;   path: "M380 168V17C380 11.4772 384.477 7 390 7H414",

&nbsp;   gradientConfig: {

&nbsp;     initial: {

&nbsp;       x1: "-40%",

&nbsp;       x2: "-10%",

&nbsp;       y1: "0%",

&nbsp;       y2: "20%",

&nbsp;     },

&nbsp;     animate: {

&nbsp;       x1: \["40%", "0%", "0%"],

&nbsp;       x2: \["10%", "0%", "0%"],

&nbsp;       y1: \["0%", "0%", "180%"],

&nbsp;       y2: \["20%", "20%", "200%"],

&nbsp;     },

&nbsp;     transition: {

&nbsp;       duration: 2,

&nbsp;       repeat: Infinity,

&nbsp;       repeatType: "loop",

&nbsp;       ease: "linear",

&nbsp;       repeatDelay: 2,

&nbsp;       delay: Math.random() \* 2,

&nbsp;     },

&nbsp;   },

&nbsp;   connectionPoints: \[

&nbsp;     { cx: 420.5, cy: 6.5, r: 6 },

&nbsp;     { cx: 380, cy: 168, r: 6 }

&nbsp;   ]

&nbsp; }

];



const gradientColors = {

&nbsp; start: "#18CCFC",

&nbsp; middle: "#6344F5",

&nbsp; end: "#AE48FF"

};



export const PulseBeamsFirstDemo = () => {

&nbsp; return (

&nbsp;   <PulseBeams

&nbsp;     beams={beams}

&nbsp;     gradientColors={gradientColors}

&nbsp;     className="bg-slate-950"

&nbsp;   >

&nbsp;     <button className="bg-slate-800 w-\[320px] z-40 h-\[120px] no-underline group cursor-pointer relative shadow-2xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6  text-white inline-block">

&nbsp;       <span className="absolute inset-0 overflow-hidden rounded-full">

&nbsp;         <span className="absolute inset-0 rounded-full bg-\[image:radial-gradient(75%\_100%\_at\_50%\_0%,rgba(56,189,248,0.6)\_0%,rgba(56,189,248,0)\_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

&nbsp;       </span>

&nbsp;       <div className="relative flex justify-center w-\[320px] text-center space-x-2 h-\[120px] items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10 ">

&nbsp;         <span className="md:text-4xl text-base inline-block bg-clip-text text-transparent bg-gradient-to-r from-neutral-300 via-neutral-600 to-neutral-300">

&nbsp;           Connect

&nbsp;         </span>

&nbsp;       </div>

&nbsp;     </button>

&nbsp;   </PulseBeams>

&nbsp; );

};

 "






