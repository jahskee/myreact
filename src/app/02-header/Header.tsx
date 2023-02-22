import React, { useState, useEffect } from "react";

export const Header = () => {
    
    useEffect(()=>{
        setInterval(() => setCurrentDateTime(new Date()), 1000);
        return ()=>{
            console.log('Cleanup function when component will unmount');
        }
    })

    const [currentDateTime, setCurrentDateTime] = useState(new Date())
    
    return <div>
        This is Header {currentDateTime.toString()}
    </div>;
}