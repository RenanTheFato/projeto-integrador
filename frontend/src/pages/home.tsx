import Cards from '@/components/cards'
import CardsLaterais from '@/components/cardsLateral'
import { MobileInfo } from '@/components/mobileInfo'
import Mapa from '@/components/mapa/mapa'



export default function Home(){
    return(
        <>
        <div className='h-full w-full'>
            <Cards/>
        <div className='hidden xl:flex'>
            <CardsLaterais/>
            <Mapa/>
        </div>
        <div className='xl:hidden'>
            <MobileInfo/>
            <Mapa/>
        </div>
        </div>
        </>
    )
}