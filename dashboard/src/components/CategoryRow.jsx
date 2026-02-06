import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CategoryRow = ({ title, icon, places, onPlaceClick, PlaceCardComponent }) => {
    const listRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const handleScroll = () => {
        if (listRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = listRef.current;
            setShowLeftArrow(scrollLeft > 0);
            // Allow a small buffer (1px) for float calculation errors
            setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1);
        }
    };

    useEffect(() => {
        handleScroll();
        // Check arrows on mount and resize
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [places]);

    const scroll = (direction) => {
        if (listRef.current) {
            const { clientWidth } = listRef.current;
            const scrollAmount = direction === 'left' ? -(clientWidth * 0.8) : (clientWidth * 0.8);
            listRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className="section-wrapper">
            <div className="section-header">
                {icon}
                <h2 className="section-title">{title}</h2>
            </div>

            <div className="carousel-container">
                {showLeftArrow && (
                    <button className="carousel-btn left" onClick={() => scroll('left')}>
                        <ChevronLeft size={24} />
                    </button>
                )}

                <div
                    className="places-row hidden-scrollbar"
                    ref={listRef}
                    onScroll={handleScroll}
                >
                    {places.map(place => (
                        <PlaceCardComponent key={place._id} place={place} onClick={() => onPlaceClick(place)} />
                    ))}
                </div>

                {showRightArrow && (
                    <button className="carousel-btn right" onClick={() => scroll('right')}>
                        <ChevronRight size={24} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default CategoryRow;
